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

// eslint-disable-next-line node/no-extraneous-import
import {Probot} from 'probot';
import {Runner} from './runner';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
// We pull in @octokit/request to crreate an appropriate type for the
// GitHubAPI interface:
// eslint-disable-next-line node/no-extraneous-import
import {request} from '@octokit/request';
import {logger} from 'gcf-utils';
import {ConfigChecker, getConfig} from '@google-automations/bot-config-utils';
import {syncLabels} from '@google-automations/label-utils';
import {
  Errors,
  GitHub,
  Manifest,
  ManifestOptions,
  ReleaseType,
  ReleaserConfig,
  getReleaserTypes,
  setLogger,
} from 'release-please';
import schema from './config-schema.json';
import {
  BranchConfiguration,
  ConfigurationOptions,
  WELL_KNOWN_CONFIGURATION_FILE,
  DEFAULT_CONFIGURATION,
} from './config-constants';
import {FORCE_RUN_LABEL, RELEASE_PLEASE_LABELS} from './labels';
type RequestBuilderType = typeof request;
type DefaultFunctionType = RequestBuilderType['defaults'];
type RequestFunctionType = ReturnType<DefaultFunctionType>;

type OctokitType = InstanceType<typeof Octokit>;

interface GitHubAPI {
  graphql: Function;
  request: RequestFunctionType;
}

function releaseTypeFromRepoLanguage(language: string | null): ReleaseType {
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
    case 'go':
      return 'go-yoshi';
    default: {
      const releasers = getReleaserTypes();
      if (releasers.includes(language.toLowerCase() as ReleaseType)) {
        return language.toLowerCase() as ReleaseType;
      } else {
        throw Error(`unknown release type: ${language}`);
      }
    }
  }
}

function findBranchConfiguration(
  branch: string,
  config: ConfigurationOptions
): BranchConfiguration[] {
  const configurations: BranchConfiguration[] = [];

  // look at primaryBranch first
  if (branch === config.primaryBranch) {
    configurations.push({
      ...config,
      ...{branch},
    });
  }

  if (config.branches) {
    for (const branchConfig of config.branches) {
      if (branch === branchConfig.branch) {
        configurations.push(branchConfig);
      }
    }
  }

  return configurations;
}

/**
 * Returns the repository's default/primary branch.
 *
 * @param {string} owner owner portion of GitHub repo URL.
 * @param {string} repo repo portion of GitHub repo URL.
 * @param {object} octokit authenticated Octokit instance.
 * @returns {string}
 */
async function getRepositoryDefaultBranch(
  owner: string,
  repo: string,
  octokit: OctokitType
) {
  const {data} = await octokit.repos.get({
    owner,
    repo,
  });
  return (
    data as {
      default_branch: string;
    }
  ).default_branch;
}

/**
 * Returns the repository's default/primary branch.
 *
 * @param {string} owner owner portion of GitHub repo URL.
 * @param {string} repo repo portion of GitHub repo URL.
 * @param {object} octokit authenticated Octokit instance.
 * @returns {string}
 */
async function getConfigWithDefaultBranch(
  owner: string,
  repo: string,
  octokit: OctokitType,
  defaultBranch?: string
): Promise<ConfigurationOptions | null> {
  const config = await getConfig<ConfigurationOptions>(
    octokit,
    owner,
    repo,
    WELL_KNOWN_CONFIGURATION_FILE,
    {schema: schema}
  );
  if (config && !config.primaryBranch) {
    config.primaryBranch =
      defaultBranch || (await getRepositoryDefaultBranch(owner, repo, octokit));
  }
  return config;
}

async function buildGitHub(
  owner: string,
  repo: string,
  octokit: GitHubAPI,
  defaultBranch?: string
): Promise<GitHub> {
  return await GitHub.create({
    owner,
    repo,
    defaultBranch,
    octokitAPIs: {
      octokit: octokit as {} as OctokitType,
      request: octokit.request,
      graphql: octokit.graphql,
    },
  });
}

async function buildManifest(
  github: GitHub,
  repoLanguage: string | null,
  configuration: BranchConfiguration
): Promise<Manifest> {
  if (configuration.manifest) {
    logger.info('building from manifest file');
    return await Manifest.fromManifest(
      github,
      configuration.branch,
      configuration.manifestConfig,
      configuration.manifestFile
    );
  }

  const releaseType = configuration.releaseType
    ? configuration.releaseType
    : configuration.manifest
    ? 'simple'
    : releaseTypeFromRepoLanguage(repoLanguage);

  const releaserConfig: ReleaserConfig = {
    releaseType,
    versioning: configuration.versioning,
    bumpMinorPreMajor: configuration.bumpMinorPreMajor,
    bumpPatchForMinorPreMajor: configuration.bumpPatchForMinorPreMajor,
    draft: configuration.draft,
    draftPullRequest: configuration.draftPullRequest,
    packageName: configuration.packageName,
    includeComponentInTag: !!configuration.monorepoTags,
    pullRequestTitlePattern: configuration.pullRequestTitlePattern,
    // changelogSections: configuration.changelogSections,
    changelogPath: configuration.changelogPath,
    changelogType: configuration.changelogType,
    versionFile: configuration.versionFile,
    extraFiles: configuration.extraFiles,
  };
  const manifestOverrides: ManifestOptions = {
    manifestPath: configuration.manifestFile,
    labels: configuration.releaseLabels,
    releaseLabels: configuration.releaseLabel?.split(','),
  };
  return await Manifest.fromConfig(
    github,
    configuration.branch,
    releaserConfig,
    manifestOverrides,
    configuration.path
  );
}

const handler = (app: Probot) => {
  app.on('push', async context => {
    const repoUrl = context.payload.repository.full_name;
    const branch = context.payload.ref.replace('refs/heads/', '');
    const repoLanguage = context.payload.repository.language;
    const {owner, repo} = context.repo();

    const remoteConfiguration = await getConfigWithDefaultBranch(
      owner,
      repo,
      context.octokit,
      context.payload.repository.default_branch
    );

    // If no configuration is specified,
    if (!remoteConfiguration) {
      logger.info(`release-please not configured for (${repoUrl})`);
      return;
    }

    const configuration = {
      ...DEFAULT_CONFIGURATION,
      ...remoteConfiguration,
    };

    // use gcf-logger as logger for release-please
    setLogger(logger);

    logger.info(`push (${repoUrl}, ${branch})`);
    const branchConfigurations = findBranchConfiguration(branch, configuration);

    if (branchConfigurations.length === 0) {
      logger.info(`no configuration for (${repoUrl}, ${branch})`);
      return;
    }

    const github = await buildGitHub(
      owner,
      repo,
      context.octokit as GitHubAPI,
      context.payload.repository.default_branch
    );

    for (const branchConfiguration of branchConfigurations) {
      logger.debug(branchConfiguration);

      let manifest = await buildManifest(
        github,
        repoLanguage,
        branchConfiguration
      );

      // release-please can handle creating a release on GitHub, we opt not to do
      // this for our repos that have autorelease enabled.
      if (branchConfiguration.handleGHRelease) {
        logger.info(`handling GitHub release for (${repoUrl})`);
        try {
          const numReleases = await Runner.createReleases(manifest);
          logger.info(`Created ${numReleases} releases`);
          if (numReleases > 0) {
            // we created a release, reload config which may include the latest
            // version
            manifest = await buildManifest(
              github,
              repoLanguage,
              branchConfiguration
            );
          }
        } catch (e) {
          if (e instanceof Errors.DuplicateReleaseError) {
            // In the future, this could raise an issue against the
            // installed repository
            logger.warn('Release tag already exists, skipping...', e);
          } else {
            throw e;
          }
        }
      }

      try {
        logger.info(`creating pull request for (${repoUrl})`);
        await Runner.createPullRequests(manifest);
      } catch (e) {
        if (e instanceof Errors.ConfigurationError) {
          // In the future, this could raise an issue against the
          // installed repository
          logger.warn(e);
          return;
        } else {
          // re-raise
          throw e;
        }
      }
    }
  });

  // See: https://github.com/octokit/webhooks.js/issues/277
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.on('schedule.repository' as any, async context => {
    const repoUrl = context.payload.repository.full_name;
    const owner = context.payload.organization.login;
    const repo = context.payload.repository.name;

    const remoteConfiguration = await getConfigWithDefaultBranch(
      owner,
      repo,
      context.octokit
    );

    // If no configuration is specified,
    if (!remoteConfiguration) {
      logger.info(`release-please not configured for (${repoUrl})`);
      return;
    }

    // syncLabels is just a nice to have feature, so we ignore all the
    // errors and continue. If this strategy becomes problematic, we
    // can create another scheduler job.
    try {
      await syncLabels(context.octokit, owner, repo, RELEASE_PLEASE_LABELS);
    } catch (e) {
      const err = e as Error;
      err.message = `Failed to sync the labels: ${err.message}`;
      logger.error(err);
    }
  });

  app.on('pull_request.labeled', async context => {
    // if missing the label, skip
    if (
      // See: https://github.com/probot/probot/issues/1366
      !context.payload.pull_request.labels.some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (label: any) => label.name === FORCE_RUN_LABEL
      )
    ) {
      logger.info(
        `ignoring non-force label action (${context.payload.pull_request.labels
          .map(label => {
            return label.name;
          })
          .join(', ')})`
      );
      return;
    }

    const repoUrl = context.payload.repository.full_name;
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const branch = context.payload.pull_request.base.ref;
    const repoLanguage = context.payload.repository.language;

    // remove the label
    await context.octokit.issues.removeLabel({
      name: FORCE_RUN_LABEL,
      issue_number: context.payload.pull_request.number,
      owner,
      repo,
    });

    // check release please config
    const remoteConfiguration = await getConfigWithDefaultBranch(
      owner,
      repo,
      context.octokit,
      context.payload.repository.default_branch
    );

    // If no configuration is specified,
    if (!remoteConfiguration) {
      logger.info(`release-please not configured for (${repoUrl})`);
      return;
    }

    const configuration = {
      ...DEFAULT_CONFIGURATION,
      ...remoteConfiguration,
    };

    logger.info(`pull_request.labeled (${repoUrl}, ${branch})`);
    const branchConfigurations = findBranchConfiguration(branch, configuration);
    if (branchConfigurations.length === 0) {
      logger.info(`no configuration for (${repoUrl}, ${branch})`);
      return;
    }

    const github = await buildGitHub(
      owner,
      repo,
      context.octokit as GitHubAPI,
      context.payload.repository.default_branch
    );

    for (const branchConfiguration of branchConfigurations) {
      logger.debug(branchConfiguration);
      const manifest = await buildManifest(
        github,
        repoLanguage,
        branchConfiguration
      );
      await Runner.createPullRequests(manifest);
    }
  });

  app.on('release.created', async context => {
    const repoUrl = context.payload.repository.full_name;
    const {owner, repo} = context.repo();
    const remoteConfiguration = await getConfig<ConfigurationOptions>(
      context.octokit,
      owner,
      repo,
      WELL_KNOWN_CONFIGURATION_FILE,
      {schema: schema}
    );

    // If no configuration is specified,
    if (!remoteConfiguration) {
      logger.info(`release-please not configured for (${repoUrl})`);
      return;
    }

    // Releases are still currently handled by autorelease, we hook into the
    // release.created webhook just to log this metric:
    logger.metric('release_please.release_created', {
      url: context.payload.repository.releases_url,
    });
  });
  // Check the config schema on PRs.
  app.on(['pull_request.opened', 'pull_request.synchronize'], async context => {
    const configChecker = new ConfigChecker<ConfigurationOptions>(
      schema,
      WELL_KNOWN_CONFIGURATION_FILE
    );
    const {owner, repo} = context.repo();
    await configChecker.validateConfigChanges(
      context.octokit,
      owner,
      repo,
      context.payload.pull_request.head.sha,
      context.payload.pull_request.number
    );
  });

  // If a release PR is closed unmerged, label with autorelease: closed
  app.on('pull_request.closed', async context => {
    const repoUrl = context.payload.repository.full_name;
    const {owner, repo} = context.repo();
    const remoteConfiguration = await getConfig<ConfigurationOptions>(
      context.octokit,
      owner,
      repo,
      WELL_KNOWN_CONFIGURATION_FILE,
      {schema: schema}
    );

    // If no configuration is specified,
    if (!remoteConfiguration) {
      logger.info(`release-please not configured for (${repoUrl})`);
      return;
    }

    if (context.payload.pull_request.merged) {
      logger.info('ignoring merged pull request');
      return;
    }

    if (
      context.payload.pull_request.labels.some(label => {
        return label.name === 'autorelease: pending';
      })
    ) {
      await Promise.all([
        context.octokit.issues.removeLabel(
          context.repo({
            issue_number: context.payload.pull_request.number,
            name: 'autorelease: pending',
          })
        ),
        context.octokit.issues.addLabels(
          context.repo({
            issue_number: context.payload.pull_request.number,
            labels: ['autorelease: closed'],
          })
        ),
      ]);
    }
  });

  // If a closed release PR is reopened, re-label with autorelease: pending
  app.on('pull_request.reopened', async context => {
    const repoUrl = context.payload.repository.full_name;
    const {owner, repo} = context.repo();
    const remoteConfiguration = await getConfig<ConfigurationOptions>(
      context.octokit,
      owner,
      repo,
      WELL_KNOWN_CONFIGURATION_FILE,
      {schema: schema}
    );

    // If no configuration is specified,
    if (!remoteConfiguration) {
      logger.info(`release-please not configured for (${repoUrl})`);
      return;
    }

    if (
      context.payload.pull_request.labels.some(label => {
        return label.name === 'autorelease: closed';
      })
    ) {
      await Promise.all([
        context.octokit.issues.removeLabel(
          context.repo({
            issue_number: context.payload.pull_request.number,
            name: 'autorelease: closed',
          })
        ),
        context.octokit.issues.addLabels(
          context.repo({
            issue_number: context.payload.pull_request.number,
            labels: ['autorelease: pending'],
          })
        ),
      ]);
    }
  });
};

export const api = {
  handler,
  getRepositoryDefaultBranch,
};
