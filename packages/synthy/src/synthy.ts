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

const SYNTHTOOL_PR = /\[CHANGE ME\]/;
interface Parent {
  sha: string;
}

export = (app: Application) => {
  app.on('pull_request.opened', async context => {
    const repo = context.payload.repository.name;
    const owner = context.payload.repository.owner.login;
    const remoteConfiguration = (await context.config(
      WELL_KNOWN_CONFIGURATION_FILE
    )) as Config;

    // TODO: put this gate back in place once our first mass synthtool PR,
    // a PR adding synthy configuration, is tested.
    // If no configuration is specified,
    // if (!remoteConfiguration) {
    //  app.log.info(`synthy not configured for (${owner}/${repo})`);
    //  return;
    // }

    const templateDirectory =
      remoteConfiguration.templateDirectory ||
      'synthtool/gcp/templates/node_library';
    const synthtoolOwner = remoteConfiguration.synthtoolOwner || 'googleapis';
    const synthtoolRepo = remoteConfiguration.synthtoolRepo || 'synthtool';
    const metadataFilename =
      remoteConfiguration.metadataFilename || 'synth.metadata';

    if (SYNTHTOOL_PR.test(context.payload.pull_request.title) === false) {
      app.log.warn(
        `title "${context.payload.pull_request.title}" does not look like synthtool PR`
      );
      return;
    }

    try {
      const commits: Set<string> = new Set();
      for (const file of await getFiles(
        context.github,
        owner,
        repo,
        context.payload.pull_request.number
      )) {
        if (file.filename === metadataFilename) continue;
        const maybeTemplatePath = `${templateDirectory}/${file.filename}`;
        const commit = await getLatestCommitForPath(
          context.github,
          synthtoolOwner,
          synthtoolRepo,
          maybeTemplatePath
        );
        if (commit === undefined) {
          throw Error(`${maybeTemplatePath} not found`);
        }
        commits.add(commit.commit.message);
      }
      // if we were able to find commits associated with all the files changed
      // in this PR, rewrite the synthtool PR accordingly.
      let title = formatCommit(commits.values().next().value);
      let body = '';
      if (commits.size > 1) {
        title = 'merge: this PR merges multiple upstream commits';
        for (const commit of commits) {
          body += `Commit: ${formatCommit(commit)}\n`;
        }
      }
      body = body.trim();

      // fetch the current contents of synth.metadata.
      const resp = await context.github.request(
        `GET /repos/:owner/:repo/contents/:path`,
        {
          owner,
          repo,
          path: metadataFilename,
          ref: context.payload.pull_request.head.ref,
        }
      );
      const content = JSON.parse(
        Buffer.from(resp.data.content, 'base64').toString('utf8')
      );

      // write the modified update time back to synth.metadata.
      content.updateTime = new Date().toISOString();
      await context.github.request(`PUT /repos/:owner/:repo/contents/:path`, {
        owner,
        repo,
        path: metadataFilename,
        message: `${title}\n\n${body}`,
        content: Buffer.from(JSON.stringify(content, null, 2), 'utf8').toString(
          'base64'
        ),
        sha: resp.data.sha,
        branch: context.payload.pull_request.head.ref,
      });

      // update the existing PR.
      context.github.pulls.update({
        owner,
        repo,
        pull_number: context.payload.pull_request.number,
        title,
        body,
      });
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

  function formatCommit(commit: string) {
    commit = commit.replace(/\(#[0-9]+\)/, '');
    commit = commit.split('\n')[0].trim();
    return commit;
  }
};
