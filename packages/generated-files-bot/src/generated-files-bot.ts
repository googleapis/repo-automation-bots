// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// eslint-disable-next-line node/no-extraneous-import
import {Probot, ProbotOctokit} from 'probot';
import {logger, addOrUpdateIssueComment} from 'gcf-utils';
import {load} from 'js-yaml';
import {query} from 'jsonpath';
import {match} from 'minimatch';

type OctokitType = InstanceType<typeof ProbotOctokit>;

const CONFIGURATION_FILE_PATH = 'generated-files-bot.yml';

interface File {
  content: string | undefined;
}

interface ExternalManifest {
  type: 'json' | 'yaml';
  file: string;
  jsonpath: string;
}

interface GeneratedFile {
  path: string;
  message?: string;
}

export interface Configuration {
  generatedFiles?: (string | GeneratedFile)[];
  externalManifests?: ExternalManifest[];
  ignoreAuthors?: string[];
}

function normalizeGeneratedFiles(
  items: (string | GeneratedFile)[]
): GeneratedFile[] {
  const collection: GeneratedFile[] = [];

  for (const item of items) {
    if (typeof item === 'string') {
      collection.push({path: item});
    } else {
      collection.push(item);
    }
  }

  return collection;
}

/**
 * Given the raw file content of an external manifest, parse the content and
 * find the data specified by the provided jsonpath.
 * @param content Unparsed manifest content
 * @param type Format of the manifest. One of 'json' or 'yaml'
 * @param jsonpath JSONpath query. See https://goessner.net/articles/JsonPath/ for
 *   the full specification.
 */
export function parseManifest(
  content: string,
  type: 'json' | 'yaml',
  jsonpath: string
): GeneratedFile[] {
  const data = type === 'json' ? JSON.parse(content) : load(content);
  const items = query(data, jsonpath);

  return normalizeGeneratedFiles(items);
}

function isFile(file: File | unknown): file is File {
  return (file as File).content !== undefined;
}

/**
 * Return the list of files specified for a single External Manifest configuration
 * @param github Octokit instance
 * @param manifest The specified ExternalManifest file
 */
async function readExternalManifest(
  github: OctokitType,
  manifest: ExternalManifest,
  owner: string,
  repo: string
): Promise<GeneratedFile[]> {
  return github.repos
    .getContent({
      owner,
      repo,
      path: manifest.file,
    })
    .then(result => {
      let content = '';
      if (isFile(result.data)) {
        content = Buffer.from(result.data.content, 'base64').toString();
      }
      return parseManifest(content, manifest.type, manifest.jsonpath);
    })
    .catch(e => {
      logger.warn(`error loading manifest: ${manifest.file}`);
      logger.warn(e);
      return [];
    });
}

/**
 * Compile the full list of templated files. Combines list from both the configuration
 * file and all specified external manifests.
 * @param config Full Template Bot configuration
 * @param github Octokit instance
 */
export async function getFileList(
  config: Configuration,
  github: OctokitType,
  owner: string,
  repo: string
): Promise<GeneratedFile[]> {
  const fileList: GeneratedFile[] = [];
  if (config.generatedFiles) {
    for (const item of normalizeGeneratedFiles(config.generatedFiles)) {
      fileList.push(item);
    }
  }

  if (config.externalManifests) {
    for (const externalManifest of config.externalManifests) {
      for (const file of await readExternalManifest(
        github,
        externalManifest,
        owner,
        repo
      )) {
        fileList.push(file);
      }
    }
  }

  return fileList;
}

/**
 * Fetch the list of files touched in the given pull request.
 * @param github Octokit instance
 * @param owner Repository owner
 * @param repo Repository name
 * @param pullNumber Pull request number
 */
export async function getPullRequestFiles(
  github: OctokitType,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<string[]> {
  const pullRequestFiles: string[] = [];
  for (const file of await github.paginate(github.pulls.listFiles, {
    owner,
    repo,
    pull_number: pullNumber,
  })) {
    pullRequestFiles.push(file.filename);
  }
  return pullRequestFiles;
}

export function buildCommentMessage(touchedTemplates: GeneratedFile[]): string {
  const lines: string[] = [];
  for (const {path, message} of touchedTemplates) {
    // an optional, custom message
    const customMessage = message ? ` - ${message}` : '';

    lines.push(`* ${path}${customMessage}`);
  }
  return (
    '*Warning*: This pull request is touching the following templated files:\n\n' +
    lines.join('\n')
  );
}

export function handler(app: Probot) {
  app.on(['pull_request.opened', 'pull_request.synchronize'], async context => {
    let config: Configuration = {};
    // Reading the config requires access to code permissions, which are not
    // always available for private repositories.
    try {
      config = (await context.config(
        CONFIGURATION_FILE_PATH,
        {}
      )) as Configuration;
    } catch (err) {
      err.message = `Error reading configuration: ${err.message}`;
      logger.error(err);
      return;
    }

    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const pullNumber = context.payload.pull_request.number;
    const prAuthor = context.payload.pull_request.user.login;

    // ignore PRs from a configurable list of authors
    if (config.ignoreAuthors?.includes(prAuthor)) {
      return;
    }

    // Read the list of templated files
    const templatedFiles = await getFileList(
      config,
      context.octokit,
      owner,
      repo
    );

    if (!templatedFiles.length) {
      logger.warn(
        'No templated files specified. Please check your configuration.'
      );
      return;
    }

    // Fetch the list of touched files in this pull request
    const pullRequestFiles = await getPullRequestFiles(
      context.octokit,
      owner,
      repo,
      pullNumber
    );

    // Compare list of PR touched files against the list of
    const touchedTemplates: GeneratedFile[] = [];
    for (const {path, message} of templatedFiles) {
      // `dot` enabled dot matching (i.e. 'a/**/b' will match 'a/.d/b')
      const matches = match(pullRequestFiles, path, {dot: true});

      for (const path of matches) {
        touchedTemplates.push({
          path,
          message,
        });
      }
    }

    // Comment on the pull request if this PR is touching any templated files
    if (touchedTemplates.length > 0) {
      const body = buildCommentMessage(touchedTemplates);

      await addOrUpdateIssueComment(
        context.octokit,
        owner,
        repo,
        pullNumber,
        context.payload.installation!.id,
        body
      );

      logger.metric('generated_files_bot.detected_modified_templated_files', {
        touchedTemplates: touchedTemplates.length,
      });
    }
  });
}
