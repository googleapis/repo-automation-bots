// Copyright 2019 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {Application} from 'probot';

// TODO: fix these imports when release-please exports types from the root
// See https://github.com/googleapis/release-please/issues/249
import {BuildOptions} from 'release-please/build/src/release-pr';
import {ReleasePRFactory} from 'release-please/build/src/release-pr-factory';
import {getReleaserNames} from 'release-please/build/src/releasers';
import {
  GitHubRelease,
  GitHubReleaseOptions,
} from 'release-please/build/src/github-release';
import {Runner} from './runner';
import {GitHubAPI} from 'probot/lib/github';
import {Octokit} from '@octokit/rest';
type OctokitType = InstanceType<typeof Octokit>;

interface ConfigurationOptions {
  primaryBranch: string;
  releaseLabels?: string[];
  releaseType?: string;
  packageName?: string;
  handleGHRelease?: boolean;
  bumpMinorPreMajor?: boolean;
}

const DEFAULT_API_URL = 'https://api.github.com';
const WELL_KNOWN_CONFIGURATION_FILE = 'release-please.yml';
const DEFAULT_CONFIGURATION: ConfigurationOptions = {
  primaryBranch: 'master',
};
const FORCE_RUN_LABEL = 'release-please:force-run';

function releaseTypeFromRepoLanguage(language: string | null): string {
  if (language === null) {
    throw Error('repository has no detected language');
  }
  switch (language.toLowerCase()) {
    case 'java':
      return 'java-yoshi';
    case 'typescript':
    case 'javascript':
      return 'node';
    case 'php':
      return 'php-yoshi';
    default: {
      const releasers = getReleaserNames();
      if (releasers.includes(language.toLowerCase())) {
        return language.toLowerCase();
      } else {
        throw Error(`unknown release type: ${language}`);
      }
    }
  }
}

// creates or updates the evergreen release-please release PR.
async function createReleasePR(
  releaseType: string,
  packageName: string,
  repoUrl: string,
  github: GitHubAPI,
  releaseLabels?: string[],
  bumpMinorPreMajor?: boolean,
  snapshot?: boolean
) {
  const buildOptions: BuildOptions = {
    packageName,
    repoUrl,
    apiUrl: DEFAULT_API_URL,
    octokitAPIs: {
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any
      octokit: (github as any) as OctokitType,
      graphql: github.graphql,
      request: github.request,
    },
    bumpMinorPreMajor,
    snapshot,
  };
  if (releaseLabels) {
    buildOptions.label = releaseLabels.join(',');
  }

  await Runner.runner(ReleasePRFactory.build(releaseType, buildOptions));
}

// turn a merged release-please release PR into a GitHub release.
async function createGitHubRelease(
  packageName: string,
  repoUrl: string,
  github: GitHubAPI
) {
  const releaseOptions: GitHubReleaseOptions = {
    label: 'autorelease: pending',
    repoUrl,
    packageName,
    apiUrl: DEFAULT_API_URL,
    octokitAPIs: {
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any
      octokit: (github as any) as OctokitType,
      graphql: github.graphql,
      request: github.request,
    },
  };
  const ghr = new GitHubRelease(releaseOptions);
  await Runner.releaser(ghr);
}

export = (app: Application) => {
  app.on('push', async context => {
    const repoUrl = context.payload.repository.full_name;
    const branch = context.payload.ref.replace('refs/heads/', '');
    const repoName = context.payload.repository.name;

    const remoteConfiguration: ConfigurationOptions | null = (await context.config(
      WELL_KNOWN_CONFIGURATION_FILE
    )) as ConfigurationOptions | null;

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

    app.log.info(`push (${repoUrl})`);

    // TODO: this should be refactored into an interface.
    await createReleasePR(
      releaseType,
      configuration.packageName || repoName,
      repoUrl,
      context.github,
      configuration.releaseLabels,
      configuration.bumpMinorPreMajor
    );

    // release-please can handle creating a release on GitHub, we opt not to do
    // this for our repos that have autorelease enabled.
    if (configuration.handleGHRelease) {
      app.log.info(`handling GitHub release for (${repoUrl})`);
      createGitHubRelease(
        configuration.packageName || repoName,
        repoUrl,
        context.github
      );
    }
  });

  app.on('schedule.repository', async context => {
    const repoUrl = context.payload.repository.full_name;
    const repoName = context.payload.repository.name;

    const remoteConfiguration = (await context.config(
      WELL_KNOWN_CONFIGURATION_FILE
    )) as ConfigurationOptions | null;

    // If no configuration is specified,
    if (!remoteConfiguration) {
      app.log.info(`release-please not configured for (${repoUrl})`);
      return;
    }

    const configuration = {
      ...DEFAULT_CONFIGURATION,
      ...remoteConfiguration,
    };

    app.log.info(`schedule.repository (${repoUrl})`);

    const releaseType = configuration.releaseType
      ? configuration.releaseType
      : 'java-yoshi';

    // TODO: this should be refactored into an interface.
    await createReleasePR(
      releaseType,
      configuration.packageName || repoName,
      repoUrl,
      context.github,
      configuration.releaseLabels,
      configuration.bumpMinorPreMajor,
      true
    );
  });

  app.on('pull_request.labeled', async context => {
    // if missing the label, skip
    if (
      !context.payload.pull_request.labels.some(
        label => label.name === FORCE_RUN_LABEL
      )
    ) {
      app.log.info(
        `ignoring non-force label action (${context.payload.pull_request.labels.join(
          ', '
        )})`
      );
      return;
    }

    const repoUrl = context.payload.repository.full_name;
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;

    // remove the label
    await context.github.issues.removeLabel({
      name: FORCE_RUN_LABEL,
      number: context.payload.pull_request.number,
      owner,
      repo,
    });

    // check release please config
    const remoteConfiguration = (await context.config(
      WELL_KNOWN_CONFIGURATION_FILE
    )) as ConfigurationOptions | null;

    // If no configuration is specified,
    if (!remoteConfiguration) {
      app.log.info(`release-please not configured for (${repoUrl})`);
      return;
    }

    const configuration = {
      ...DEFAULT_CONFIGURATION,
      ...remoteConfiguration,
    };

    app.log.info(`pull_request.labeled (${repoUrl})`);

    // run release-please
    const releaseType = configuration.releaseType
      ? configuration.releaseType
      : releaseTypeFromRepoLanguage(context.payload.repository.language);

    // TODO: this should be refactored into an interface.
    await createReleasePR(
      releaseType,
      configuration.packageName || repo,
      repoUrl,
      context.github,
      configuration.releaseLabels,
      configuration.bumpMinorPreMajor
    );
  });
};
