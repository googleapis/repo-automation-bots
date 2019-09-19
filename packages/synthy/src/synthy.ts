/**
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Application } from 'probot';
import { GitHubAPI } from 'probot/lib/github';
import {
  PullsListFilesResponseItem,
  PullsListCommitsResponseItem,
} from '@octokit/rest';

const WELL_KNOWN_CONFIGURATION_FILE = 'synthy.yml';
interface Config {
  templateDirectory?: string;
  synthtoolOwner?: string;
  synthtoolRepo?: string;
  metadataFilename?: string;
}

export = (app: Application) => {
  app.on('pull_request', async context => {
    const repo = context.payload.repository.name;
    const owner = context.payload.repository.owner.login;
    const remoteConfiguration = await context.config(
      WELL_KNOWN_CONFIGURATION_FILE
    ) as Config;

    // If no configuration is specified,
    if (!remoteConfiguration) {
      app.log.info(`synthy not configured for (${owner}/${repo})`);
      return;
    }

    const templateDirectory = remoteConfiguration.templateDirectory || 'synthtool/gcp/templates/node_library';
    const synthtoolOwner = remoteConfiguration.synthtoolOwner || 'googleapis';
    const synthtoolRepo = remoteConfiguration.synthtoolRepo || 'synthtool';
    const metadataFilename = remoteConfiguration.metadataFilename || 'synth.metadata';

    let commitMessages: string[] = [];
    try {
      for (const file of await getFiles(
        context.github,
        owner,
        repo,
        context.payload.pull_request.number
      )) {
        if (file.filename === metadataFilename) continue;
        const maybeTemplatePath = `${templateDirectory}/${file.filename}`;
        const commit = await getLatestCommitForPath(context.github, synthtoolOwner, synthtoolRepo, maybeTemplatePath);
        if (commit === undefined) {
          throw Error(`${maybeTemplatePath} not found`);
        }
        commitMessages.push(commit.commit.message);
      }
      
      // Only template files changed, build up an appropriate commit
      // message given this information.
      app.log.info(commitMessages);
    } catch (err) {
      app.log.warn(err.message);
    }
  });

  async function getFiles(
    github: GitHubAPI,
    owner: string,
    repo: string,
    pullRequestNumber: number
  ): Promise<PullsListFilesResponseItem[]> {
    return (await github.pulls.listFiles({
      owner,
      repo,
      pull_number: pullRequestNumber,
      per_page: 300,
    })).data;
  }

  async function getLatestCommitForPath(
    github: GitHubAPI,
    owner: string,
    repo: string,
    path: string
  ): Promise<PullsListCommitsResponseItem> {
    return (await github.repos.listCommits({
      owner,
      repo,
      path,
      per_page: 1,
    })).data[0];
  }
};
