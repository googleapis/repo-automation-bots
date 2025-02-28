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
// eslint-disable-next-line node/no-extraneous-import
import {RequestError} from '@octokit/request-error';
import {
  getContextLogger,
  GCFLogger,
  getAuthenticatedOctokit,
  logger as defaultLogger,
} from 'gcf-utils';
import {
  getConfig,
  MultiConfigChecker,
} from '@google-automations/bot-config-utils';
import {withDatastoreLock} from '@google-automations/datastore-lock';
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
  manifestSchema,
  configSchema,
  Logger,
  PluginType,
  CreatedRelease,
} from 'release-please';
import schema from './config-schema.json';
import {
  BranchConfiguration,
  ConfigurationOptions,
  WELL_KNOWN_CONFIGURATION_FILE,
  DEFAULT_CONFIGURATION,
} from './config-constants';
import {FORCE_RUN_LABEL, RELEASE_PLEASE_LABELS} from './labels';
import {addOrUpdateIssue} from '@google-automations/issue-utils';
type RequestBuilderType = typeof request;
type DefaultFunctionType = RequestBuilderType['defaults'];
type RequestFunctionType = ReturnType<DefaultFunctionType>;

type OctokitType = InstanceType<typeof Octokit>;

interface GitHubAPI {
  graphql: Function;
  request: RequestFunctionType;
}
const DEFAULT_RELEASE_PLEASE_CONFIG = 'release-please-config.json';
const DEFAULT_RELEASE_PLEASE_MANIFEST = '.release-please-manifest.json';
const BOT_NAME = 'release-please[bot]';

class BotConfigurationError extends Error {}

function releaseTypeFromRepoLanguage(language: string | null): ReleaseType {
  if (language === null) {
    throw new BotConfigurationError('repository has no detected language');
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
        throw new BotConfigurationError(`unknown release type: ${language}`);
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
    WELL_KNOWN_CONFIGURATION_FILE
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
  defaultBranch?: string,
  logger?: Logger
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
    logger,
  });
}

async function buildManifest(
  github: GitHub,
  repoLanguage: string | null,
  configuration: BranchConfiguration,
  logger: GCFLogger,
  plugins: Array<PluginType>
): Promise<Manifest> {
  if (configuration.manifest) {
    logger.info('building from manifest file');
    return await Manifest.fromManifest(
      github,
      configuration.branch,
      configuration.manifestConfig,
      configuration.manifestFile,
      {
        logger,
      }
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
    changelogHost: configuration.changelogHost,
    changelogPath: configuration.changelogPath,
    changelogType: configuration.changelogType,
    versionFile: configuration.versionFile,
    extraFiles: configuration.extraFiles,
    initialVersion: configuration.initialVersion,
  };
  const manifestOverrides: ManifestOptions = {
    manifestPath: configuration.manifestFile,
    labels: configuration.releaseLabels,
    releaseLabels: configuration.releaseLabel?.split(','),
    plugins,
    logger,
  };
  return await Manifest.fromConfig(
    github,
    configuration.branch,
    releaserConfig,
    manifestOverrides,
    configuration.path
  );
}

const RP_LOCK_ID = 'release-please';
const RP_LOCK_DURATION_MS = 60 * 1000;
const RP_LOCK_ACQUIRE_TIMEOUT_MS = 120 * 1000;
interface RunBranchOptions {
  logger?: GCFLogger;
  skipPullRequest?: boolean;
}
async function runBranchConfigurationWithConfigurationHandling(
  github: GitHub,
  repoLanguage: string | null,
  repoUrl: string,
  branchConfiguration: BranchConfiguration,
  octokit: Octokit,
  options: RunBranchOptions
): Promise<CreatedRelease[] | undefined> {
  const target = `${repoUrl}---${branchConfiguration.branch}`;
  await withDatastoreLock(
    {
      lockId: RP_LOCK_ID,
      target,
      lockExpiry: RP_LOCK_DURATION_MS,
      lockAcquireTimeout: RP_LOCK_ACQUIRE_TIMEOUT_MS,
    },
    async () => {
      return await runBranchConfigurationWithConfigurationHandlingWithoutLock(
        github,
        repoLanguage,
        repoUrl,
        branchConfiguration,
        octokit,
        options
      );
    }
  );
}
async function runBranchConfigurationWithConfigurationHandlingWithoutLock(
  github: GitHub,
  repoLanguage: string | null,
  repoUrl: string,
  branchConfiguration: BranchConfiguration,
  octokit: Octokit,
  options: RunBranchOptions
): Promise<CreatedRelease[] | undefined> {
  const logger = options.logger ?? defaultLogger;
  try {
    return await runBranchConfiguration(
      github,
      repoLanguage,
      repoUrl,
      branchConfiguration,
      options
    );
  } catch (e) {
    if (e instanceof Errors.ConfigurationError) {
      // In the future, this could raise an issue against the
      // installed repository
      logger.warn(e);
      await addOrUpdateIssue(
        octokit,
        github.repository.owner,
        github.repository.repo,
        'Configuration error for release-please',
        e.message,
        ['release-please'],
        logger
      );
    } else if (e instanceof BotConfigurationError) {
      logger.warn(e);
      await addOrUpdateIssue(
        octokit,
        github.repository.owner,
        github.repository.repo,
        'Configuration error for release-please',
        e.message,
        ['release-please'],
        logger
      );
    } else {
      // re-raise
      throw e;
    }
  }
}

// TODO: Allow this functionality to be enabled via an
// org level config in a .github repository:
const ORG_SENTENCE_CASE_ENABLED = new Set<string>([
  'chingor13',
  'bcoe',
  'googleapis',
]);
function isSentenceCaseEnabled(repoUrl: string) {
  const [org] = repoUrl.split('/');
  return ORG_SENTENCE_CASE_ENABLED.has(org);
}

async function runBranchConfiguration(
  github: GitHub,
  repoLanguage: string | null,
  repoUrl: string,
  branchConfiguration: BranchConfiguration,
  options: RunBranchOptions
): Promise<CreatedRelease[] | undefined>  {
  const logger = options.logger ?? defaultLogger;
  const plugins: Array<PluginType> = [
    ...(isSentenceCaseEnabled(repoUrl)
      ? [
          {
            type: 'sentence-case',
            specialWords: ['gRPC', 'npm'],
          },
        ]
      : []),
  ];

  let manifest: Manifest | null = null;
  // release-please can handle creating a release on GitHub, we opt not to do
  // this for our repos that have autorelease enabled.
  if (branchConfiguration.handleGHRelease) {
    logger.info(`handling GitHub release for (${repoUrl})`);
    manifest = await buildManifest(
      github,
      repoLanguage,
      branchConfiguration,
      logger,
      plugins
    );
    try {
      const releases = await Runner.createReleases(manifest);
      logger.info(`Created ${releases.length} releases`);
      if (releases.length > 0) {
        // we created a release, reload config which may include the latest
        // version
        manifest = null;
      }
      return releases;
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

  if (options.skipPullRequest) {
    logger.info(`skipping pull request from configuration for (${repoUrl})`);
  } else {
    logger.info(`creating pull request for (${repoUrl})`);
    if (!manifest) {
      manifest = await buildManifest(
        github,
        repoLanguage,
        branchConfiguration,
        logger,
        plugins
      );
    }
    await Runner.createPullRequests(manifest);
  }
}

interface GitHubCommit {
  message: string;
  author: {
    name: string;
  };
}
// Helper function to determine if list of commits includes something that
// looks like a release.
function hasReleaseCommit(commits: GitHubCommit[]): boolean {
  return !!commits.find(
    commit =>
      commit.message.includes('release') && commit.author.name === BOT_NAME
  );
}

const handler = (app: Probot) => {
  app.on('push', async context => {
    const logger = getContextLogger(context);

    // Skip archived and disabled repos
    if (context.payload.repository.archived) {
      logger.debug('Skipping archived repository');
      return;
    }
    if (context.payload.repository.disabled) {
      logger.debug('Skipping disabled repository');
      return;
    }

    const repoUrl = context.payload.repository.full_name;
    const branch = context.payload.ref.replace('refs/heads/', '');
    const repoLanguage = context.payload.repository.language;
    const {owner, repo} = context.repo();
    let octokit: Octokit;
    if (context.payload.installation?.id) {
      octokit = await getAuthenticatedOctokit(context.payload.installation.id);
    } else {
      throw new Error(
        'Installation ID not provided in push event payload.' +
          ' We cannot authenticate Octokit.'
      );
    }

    const remoteConfiguration = await getConfigWithDefaultBranch(
      owner,
      repo,
      octokit,
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
      octokit as GitHubAPI,
      context.payload.repository.default_branch,
      logger
    );

    for (const branchConfiguration of branchConfigurations) {
      // if branch is configured for on-demand releases, then skip the push event
      // unless it looks like a release (we)
      if (
        branchConfiguration.onDemand &&
        !hasReleaseCommit(context.payload.commits)
      ) {
        logger.info(
          `skipping push event for on-demand ${repoUrl}, ${branchConfiguration.branch}`
        );
        continue;
      }

      logger.debug(branchConfiguration);
      await runBranchConfigurationWithConfigurationHandling(
        github,
        repoLanguage,
        repoUrl,
        branchConfiguration,
        octokit,
        {logger, skipPullRequest: branchConfiguration.onDemand}
      );
    }

  // See: https://github.com/octokit/webhooks.js/issues/277
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.on('schedule.repository' as any, async context => {
    const logger = getContextLogger(context);
    const repoUrl = context.payload.repository.full_name;
    const owner = context.payload.organization.login;
    const repo = context.payload.repository.name;
    let octokit: Octokit;
    if (context.payload.installation?.id) {
      octokit = await getAuthenticatedOctokit(context.payload.installation.id);
    } else {
      throw new Error(
        `Installation ID not provided in ${context.payload.action} event.` +
          ' We cannot authenticate Octokit.'
      );
    }

    const remoteConfiguration = await getConfigWithDefaultBranch(
      owner,
      repo,
      octokit
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
      await syncLabels(octokit, owner, repo, RELEASE_PLEASE_LABELS);
    } catch (e) {
      const err = e as Error;
      err.message = `Failed to sync the labels: ${err.message}`;
      logger.error(err);
    }
  });

  app.on('pull_request.labeled', async context => {
    const logger = getContextLogger(context);

    // Skip archived and disabled repos
    if (context.payload.repository.archived) {
      logger.debug('Skipping archived repository');
      return;
    }
    if (context.payload.repository.disabled) {
      logger.debug('Skipping disabled repository');
      return;
    }

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
    let octokit: Octokit;
    if (context.payload.installation?.id) {
      octokit = await getAuthenticatedOctokit(context.payload.installation.id);
    } else {
      throw new Error(
        `Installation ID not provided in ${context.payload.action} event.` +
          ' We cannot authenticate Octokit.'
      );
    }

    // remove the label
    try {
      await octokit.issues.removeLabel({
        name: FORCE_RUN_LABEL,
        issue_number: context.payload.pull_request.number,
        owner,
        repo,
      });
    } catch (e) {
      if (e instanceof RequestError && e.status === 404) {
        // on retries, the label may no longer exist on the PR
        logger.info('label no longer exists on PR');
      } else {
        throw e;
      }
    }

    // check release please config
    const remoteConfiguration = await getConfigWithDefaultBranch(
      owner,
      repo,
      octokit,
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
      octokit as GitHubAPI,
      context.payload.repository.default_branch,
      logger
    );

    for (const branchConfiguration of branchConfigurations) {
      logger.debug(branchConfiguration);
      await runBranchConfigurationWithConfigurationHandling(
        github,
        repoLanguage,
        repoUrl,
        branchConfiguration,
        octokit,
        {logger}
      );
    }
  });

  app.on('release.created', async context => {
    const logger = getContextLogger(context);
    const repoUrl = context.payload.repository.full_name;
    const {owner, repo} = context.repo();
    let octokit: Octokit;
    if (context.payload.installation?.id) {
      octokit = await getAuthenticatedOctokit(context.payload.installation.id);
    } else {
      throw new Error(
        `Installation ID not provided in ${context.payload.action} event.` +
          ' We cannot authenticate Octokit.'
      );
    }
    const remoteConfiguration = await getConfig<ConfigurationOptions>(
      octokit,
      owner,
      repo,
      WELL_KNOWN_CONFIGURATION_FILE
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
    const logger = getContextLogger(context);
    const repoUrl = context.payload.repository.full_name;
    const baseBranch = context.payload.pull_request.base.ref;
    const prNumber = context.payload.pull_request.number;
    const headSha = context.payload.pull_request.head.sha;
    const defaultBranch = context.payload.pull_request.base.repo.default_branch;

    const headOwner = context.payload.pull_request.head.repo.owner.login;
    const headRepo = context.payload.pull_request.head.repo.name;
    const headBranch = context.payload.pull_request.head.ref;
    let octokit: Octokit;
    if (context.payload.installation?.id) {
      octokit = await getAuthenticatedOctokit(context.payload.installation.id);
    } else {
      throw new Error(
        `Installation ID not provided in ${context.payload.action} event.` +
          ' We cannot authenticate Octokit.'
      );
    }

    const schemasByFile: Record<string, object> = {
      '.github/release-please.yml': schema,
    };
    const remoteConfiguration = await getConfig<ConfigurationOptions>(
      octokit,
      headOwner,
      headRepo,
      WELL_KNOWN_CONFIGURATION_FILE,
      {branch: headBranch}
    );

    // If no configuration is specified,
    if (!remoteConfiguration) {
      logger.info(`release-please not configured for (${repoUrl})`);
      return;
    }
    if (!remoteConfiguration.primaryBranch) {
      remoteConfiguration.primaryBranch = defaultBranch;
    }

    // Use a try/catch here because we are validating the `.github/release-please.yml`
    // file after the fact so it's possible that the config does not match as expected
    // (e.g. if `branches` is not an array)
    try {
      const branchConfigurations = findBranchConfiguration(
        baseBranch,
        remoteConfiguration
      );
      logger.info(
        `found ${branchConfigurations.length} configuration(s) for ${baseBranch}`
      );

      // Collect all manifest configs
      for (const branchConfig of branchConfigurations) {
        if (branchConfig.manifest) {
          schemasByFile[
            branchConfig.manifestConfig || DEFAULT_RELEASE_PLEASE_CONFIG
          ] = configSchema;
          schemasByFile[
            branchConfig.manifestFile || DEFAULT_RELEASE_PLEASE_MANIFEST
          ] = manifestSchema;
        }
      }
    } catch (e) {
      if (e instanceof Error) {
        logger.warn(e);
      } else {
        throw e;
      }
    }

    // The config checker fetches and validates each touched config file
    // against the specified schema. It creates a failing commit check for
    // each invalid file.
    const configChecker = new MultiConfigChecker(schemasByFile);
    const {owner, repo} = context.repo();
    await configChecker.validateConfigChanges(
      octokit,
      owner,
      repo,
      headSha,
      prNumber
    );
  });

  // If a release PR is closed unmerged, label with autorelease: closed
  app.on('pull_request.closed', async context => {
    const logger = getContextLogger(context);
    const repoUrl = context.payload.repository.full_name;
    const {owner, repo} = context.repo();
    let octokit: Octokit;
    if (context.payload.installation?.id) {
      octokit = await getAuthenticatedOctokit(context.payload.installation.id);
    } else {
      throw new Error(
        `Installation ID not provided in ${context.payload.action} event.` +
          ' We cannot authenticate Octokit.'
      );
    }
    const remoteConfiguration = await getConfig<ConfigurationOptions>(
      octokit,
      owner,
      repo,
      WELL_KNOWN_CONFIGURATION_FILE
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
        octokit.issues.removeLabel(
          context.repo({
            issue_number: context.payload.pull_request.number,
            name: 'autorelease: pending',
          })
        ),
        octokit.issues.addLabels(
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
    const logger = getContextLogger(context);
    const repoUrl = context.payload.repository.full_name;
    const {owner, repo} = context.repo();
    let octokit: Octokit;
    if (context.payload.installation?.id) {
      octokit = await getAuthenticatedOctokit(context.payload.installation.id);
    } else {
      throw new Error(
        `Installation ID not provided in ${context.payload.action} event.` +
          ' We cannot authenticate Octokit.'
      );
    }
    const remoteConfiguration = await getConfig<ConfigurationOptions>(
      octokit,
      owner,
      repo,
      WELL_KNOWN_CONFIGURATION_FILE
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
        octokit.issues.removeLabel(
          context.repo({
            issue_number: context.payload.pull_request.number,
            name: 'autorelease: closed',
          })
        ),
        octokit.issues.addLabels(
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
