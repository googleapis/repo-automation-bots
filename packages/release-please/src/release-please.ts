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

// TODO: fix these imports when release-please exports types from the root
import { ReleaseType, BuildOptions } from 'release-please/build/src/release-pr';
import { ReleasePRFactory } from 'release-please/build/src/release-pr-factory';
import { Runner } from './runner';

interface ConfigurationOptions {
  primaryBranch: string;
  releaseLabels?: string[];
  releaseType?: ReleaseType;
}

const DEFAULT_API_URL = 'https://api.github.com';
const WELL_KNOWN_CONFIGURATION_FILE = 'release-please.yml';
const DEFAULT_CONFIGURATION: ConfigurationOptions = {
  primaryBranch: 'master',
  releaseLabels: ['autorelease: pending', 'type: process'],
};

function releaseTypeFromRepoLanguage(language: string | null): ReleaseType {
  switch (language) {
    case 'Ruby':
    case 'ruby':
      return ReleaseType.RubyYoshi;
    case 'Java':
    case 'java':
      return ReleaseType.JavaYoshi;
    case 'TypeScript':
    case 'JavaScript':
      return ReleaseType.Node;
    case 'PHP':
    case 'php':
      return ReleaseType.PHPYoshi;
    default:
      throw Error('unknown release type');
  }
}

export = (app: Application) => {
  app.on('push', async context => {
    const repoUrl = context.payload.repository.full_name;
    const branch = context.payload.ref.replace('refs/heads/', '');
    const repoName = context.payload.repository.name;

    const configuration = (await context.config(
      WELL_KNOWN_CONFIGURATION_FILE,
      DEFAULT_CONFIGURATION
    )) as ConfigurationOptions;

    if (branch !== configuration.primaryBranch) {
      app.log.info(
        `Not on primary branch (${configuration.primaryBranch}): ${branch}`
      );
      return;
    }

    const releaseType = configuration.releaseType
      ? configuration.releaseType
      : releaseTypeFromRepoLanguage(context.payload.repository.language);
    const buildOptions: BuildOptions = {
      packageName: repoName,
      repoUrl,
      apiUrl: DEFAULT_API_URL,
      octokitAPIs: {
        octokit: context.github,
        graphql: context.github.graphql,
        request: context.github.request,
      },
    };
    if (configuration.releaseLabels) {
      buildOptions.label = configuration.releaseLabels.join(',');
    }

    Runner.runner(ReleasePRFactory.build(releaseType, buildOptions));
  });
};
