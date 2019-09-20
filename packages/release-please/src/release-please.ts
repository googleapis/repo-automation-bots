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
// See https://github.com/googleapis/release-please/issues/249
import { ReleaseType, BuildOptions } from 'release-please/build/src/release-pr';
import { ReleasePRFactory } from 'release-please/build/src/release-pr-factory';
import { Runner } from './runner';
import { GitHubAPI } from 'probot/lib/github';

interface ConfigurationOptions {
  primaryBranch: string;
  releaseLabels?: string[];
  releaseType?: ReleaseType;
}

const DEFAULT_API_URL = 'https://api.github.com';
const WELL_KNOWN_CONFIGURATION_FILE = 'release-please.yml';
const DEFAULT_CONFIGURATION: ConfigurationOptions = {
  primaryBranch: 'master',
};

function releaseTypeFromRepoLanguage(language: string | null): ReleaseType {
  if (language == null) {
    throw Error('repository has no detected language');
  }
  switch (language.toLowerCase()) {
    case 'ruby':
      return ReleaseType.RubyYoshi;
    case 'java':
      return ReleaseType.JavaYoshi;
    case 'typescript':
    case 'javascript':
      return ReleaseType.Node;
    case 'php':
      return ReleaseType.PHPYoshi;
    default:
      throw Error(`unknown release type: ${language}`);
  }
}

function runReleasePlease(
  releaseType: ReleaseType,
  repoName: string,
  repoUrl: string,
  github: GitHubAPI,
  releaseLabels?: string[]
) {
  const buildOptions: BuildOptions = {
    packageName: repoName,
    repoUrl,
    apiUrl: DEFAULT_API_URL,
    octokitAPIs: {
      octokit: github,
      graphql: github.graphql,
      request: github.request,
    },
  };
  if (releaseLabels) {
    buildOptions.label = releaseLabels.join(',');
  }

  Runner.runner(ReleasePRFactory.build(releaseType, buildOptions));
}

export = (app: Application) => {
  app.on('push', async context => {
    const repoUrl = context.payload.repository.full_name;
    const branch = context.payload.ref.replace('refs/heads/', '');
    const repoName = context.payload.repository.name;

    const remoteConfiguration = await context.config(
      WELL_KNOWN_CONFIGURATION_FILE
    );

    // If no configuration is specified,
    if (!remoteConfiguration) {
      app.log.info(`release-please not configured for (${repoUrl})`);
      return;
    }

    const configuration = {
      ...DEFAULT_CONFIGURATION,
      ...remoteConfiguration,
    };

    if (branch !== configuration.primaryBranch) {
      app.log.info(
        `Not on primary branch (${configuration.primaryBranch}): ${branch}`
      );
      return;
    }

    const releaseType = configuration.releaseType
      ? configuration.releaseType
      : releaseTypeFromRepoLanguage(context.payload.repository.language);

    runReleasePlease(
      releaseType,
      repoName,
      repoUrl,
      context.github,
      configuration.releaseLabels
    );
  });

  app.on('release.published', async context => {
    if (context.payload.action !== 'published') {
      app.log.info(
        `ingoring non-publish release action (${context.payload.action})`
      );
      return;
    }
    const repoUrl = context.payload.repository.full_name;
    const repoName = context.payload.repository.name;

    const remoteConfiguration = await context.config(
      WELL_KNOWN_CONFIGURATION_FILE
    );

    // If no configuration is specified,
    if (!remoteConfiguration) {
      app.log.info(`release-please not configured for (${repoUrl})`);
      return;
    }

    const configuration = {
      ...DEFAULT_CONFIGURATION,
      ...remoteConfiguration,
    };

    const releaseType = configuration.releaseType
      ? configuration.releaseType
      : releaseTypeFromRepoLanguage(context.payload.repository.language);
    runReleasePlease(
      releaseType,
      repoName,
      repoUrl,
      context.github,
      configuration.releaseLabels
    );
  });
};
