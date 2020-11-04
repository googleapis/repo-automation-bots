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

import {Application, ProbotOctokit} from 'probot';
import {logger} from 'gcf-utils';
import {safeLoad} from 'js-yaml';
import {query} from 'jsonpath';

type OctokitType = InstanceType<typeof ProbotOctokit>;

const CONFIGURATION_FILE_PATH = 'generated-files-bot.yml';

interface ExternalManifest {
  type: 'json' | 'yaml';
  file: string;
  jsonpath: string;
}

export interface Configuration {
  generatedFiles?: string[];
  externalManifests?: ExternalManifest[];
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
): string[] {
  const data = type === 'json' ? JSON.parse(content) : safeLoad(content);
  return query(data, jsonpath);
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
): Promise<Set<string>> {
  return github.repos
    .getContent({
      owner,
      repo,
      path: manifest.file,
    })
    .then(result => {
      const content = Buffer.from(result.data.content, 'base64').toString();
      return new Set(parseManifest(content, manifest.type, manifest.jsonpath));
    })
    .catch(e => {
      logger.warn(`error loading manifest: ${manifest.file}`);
      logger.warn(e);
      return new Set();
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
): Promise<string[]> {
  const fileList: string[] = [];
  if (config.generatedFiles) {
    for (const file of config.generatedFiles) {
      fileList.push(file);
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

export function buildCommentMessage(touchedTemplates: Set<string>): string {
  const lines: string[] = [];
  for (const filename of touchedTemplates) {
    lines.push(`* ${filename}`);
  }
  return (
    '*Warning*: This pull request is touching the following templated files:\n\n' +
    lines.join('\n')
  );
}

export function handler(app: Application) {
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

    // Read the list of templated files
    const templatedFiles = new Set(
      await getFileList(config, context.github, owner, repo)
    );
    if (templatedFiles.size === 0) {
      logger.warn(
        'No templated files specified. Please check your configuration.'
      );
      return;
    }

    // Fetch the list of touched files in this pull request
    const pullRequestFiles = await getPullRequestFiles(
      context.github,
      owner,
      repo,
      pullNumber
    );

    // Compare list of PR touched files against the list of
    const touchedTemplates = new Set<string>();
    for (const file of pullRequestFiles) {
      if (templatedFiles.has(file)) {
        touchedTemplates.add(file);
      }
    }

    // Comment on the pull request if this PR is touching any templated files
    if (touchedTemplates.size > 0) {
      const body = buildCommentMessage(touchedTemplates);
      await context.github.issues.createComment({
        owner,
        repo,
        issue_number: pullNumber,
        body,
      });
    }
  });
}
