// Copyright 2023 Google LLC
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

import {Octokit} from '@octokit/rest';
import {ValidationResult, Validate} from './validate';
import {RepositoryFileCache} from '@google-automations/git-file-utils';

import {GCFLogger, logger as defaultLogger} from 'gcf-utils';
import {IssueOpener} from './issue-opener';
/* eslint-disable-next-line node/no-extraneous-import */
import {RequestError} from '@octokit/request-error';

export async function scanRepoAndOpenIssues(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  logger: GCFLogger = defaultLogger
) {
  const results = await scanRepo(octokit, owner, repo, branch);
  if (results.length === 0) {
    logger.info(`no validation errors found for ${owner}/${repo}`);
  } else {
    logger.info(
      `${results.length} validation errors found for ${owner}/${repo}`
    );
  }

  const opener = new IssueOpener(owner, repo, octokit, logger);
  try {
    await opener.open(results);
  } catch (e) {
    if (e instanceof RequestError && e.status === 410) {
      logger.warn(
        `Issues are disabled on repo: ${owner}/${repo}, but would have opened an issue: ${e.request.body}`
      );
      return;
    }
    throw e;
  }
}

export async function scanRepo(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string
): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  const validate = new Validate(octokit);
  const fileCache = new RepositoryFileCache(octokit, {owner, repo});
  // Scan .repo-metadata.json in the repository:
  const metadataFiles = await fileCache.findFilesByFilename(
    '.repo-metadata.json',
    branch
  );
  for (const path of metadataFiles) {
    const content = await fileCache.getFileContents(path, branch);
    const result = await validate.validate(path, content.parsedContent);
    if (result.status === 'error') {
      results.push(result);
    }
  }
  // Scan for the .repo-metadata-full.json, see:
  // https://github.com/googleapis/google-cloud-go/blob/main/internal/.repo-metadata-full.json
  const metadataFullPath = (
    await fileCache.findFilesByFilename('.repo-metadata-full.json', branch)
  )[0];
  if (metadataFullPath) {
    const content = await fileCache.getFileContents(metadataFullPath, branch);
    const metadataAll = JSON.parse(content.parsedContent);
    for (const lib of Object.keys(metadataAll)) {
      const result = await validate.validate(
        metadataFullPath,
        JSON.stringify(metadataAll[lib])
      );
      if (result.status === 'error') {
        results.push(result);
      }
    }
  }
  return results;
}
