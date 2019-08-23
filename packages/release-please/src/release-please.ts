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
import { ReleaseType } from 'release-please/build/src/release-pr';
import { JavaYoshi } from 'release-please/build/src/releasers/java-yoshi';

interface ConfigurationOptions {
  strategy?: string,
  primaryBranch: string,
  releaseLabels: string[]
}

const DEFAULT_API_URL = 'https://api.github.com';
const WELL_KNOWN_CONFIGURATION_FILE = '.bots/release-please.json';
const DEFAULT_CONFIGURATION: ConfigurationOptions = {
  primaryBranch: 'master',
  releaseLabels: ['autorelease: pending', 'type: process'],
};

async function fromGitHub(
  path: string,
  owner: string,
  repo: string,
  ref: string,
  github: GitHubAPI
): Promise<ConfigurationOptions> {
  try {
    const response = await github.repos.getContents({
      owner,
      repo,
      ref,
      path,
    });
    const fileContents = Buffer.from(
      response.data.content,
      'base64'
    ).toString('utf8');
    return {
      ...DEFAULT_CONFIGURATION,
      ...JSON.parse(fileContents),
    };
  } catch (_) {
    return DEFAULT_CONFIGURATION;
  }
}

export = (app: Application) => {
  app.on('push', async context => {
    const repoUrl = context.payload.repository.full_name;
    const branch = context.payload.ref.replace('refs/heads/', '');
    const packageName = context.payload.repository.name;

    const configuration = await fromGitHub(
      WELL_KNOWN_CONFIGURATION_FILE,
      context.payload.repository.owner.login,
      context.payload.repository.name,
      branch,
      context.github
    );

    if (branch != configuration.primaryBranch) {
      app.log.info(`Not on primary branch (${configuration.primaryBranch}): ${branch}`);
      return;
    }

    const rp = new JavaYoshi({
      releaseType: ReleaseType.JavaYoshi,
      packageName,
      repoUrl,
      label: configuration.releaseLabels.join(','),
      apiUrl: DEFAULT_API_URL,
      octokitAPIs: {
        octokit: context.github,
        graphql: context.github.graphql,
        request: context.github.request,
      }
    });
    rp.run();
  });
};
