// Copyright 2021 Google LLC
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

// eslint-disable-next-line node/no-extraneous-import
import {Probot} from 'probot';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
import {logger} from 'gcf-utils';
import {ConfigChecker, getConfig} from '@google-automations/bot-config-utils';
import schema from './config-schema.json';
import {
  ConfigurationOptions,
  WELL_KNOWN_CONFIGURATION_FILE,
} from './config-constants';

const PENDING_LABEL = 'autorelease: pending';
const TRIGGERED_LABEL = 'autorelease: triggered';
interface Repository {
  full_name: string;
  owner: {
    login: string;
  };
  name: string;
}

interface PullRequest {
  html_url: string;
  number: number;
  state: string;
  labels: {
    name?: string;
  }[];
  merge_commit_sha: string | null;
  user?: {
    login?: string | undefined;
  } | null;
  base: {
    repo: {
      owner?: {
        login?: string | null;
      } | null;
      name: string;
    };
  };
}

function getJobName(
  config: ConfigurationOptions,
  repository: Repository
): string | undefined {
  if (config.jobName) {
    return config.jobName;
  }

  // run releasetool get job name
  return 'FIXME';
}

function isReleasePullRequest(pullRequest: PullRequest): boolean {
  return (
    pullRequest.labels.some(label => {
      return label.name === PENDING_LABEL;
    }) &&
    !pullRequest.labels.some(label => {
      return label.name === TRIGGERED_LABEL;
    })
  );
}

async function findReleasePullRequests(
  octokit: Octokit,
  repository: Repository,
  maxNumber = 5
): Promise<PullRequest[]> {
  const listGenerator = octokit.paginate.iterator(octokit.pulls.list, {
    owner: repository.owner.login,
    repo: repository.name,
    state: 'closed',
    sort: 'updated',
    direction: 'desc',
  });

  const found: PullRequest[] = [];
  for await (const listResponse of listGenerator) {
    for (const pullRequest of listResponse.data) {
      if (isReleasePullRequest(pullRequest)) {
        found.push(pullRequest);
        if (found.length >= maxNumber) {
          break;
        }
      }
    }
  }
  return found;
}

async function triggerKokoroJob(jobName: string, pullRequest: PullRequest) {
  logger.info(`triggering job: ${jobName} for ${pullRequest.number}`);
  // FIXME
}

async function markTriggered(octokit: Octokit, pullRequest: PullRequest) {
  const owner = pullRequest.base.repo.owner?.login;
  if (!owner) {
    logger.error(`no owner for ${pullRequest.number}`);
    return;
  }
  logger.info('adding `autorelease: triggered` label');
  await octokit.issues.addLabels({
    owner,
    repo: pullRequest.base.repo.name,
    issue_number: pullRequest.number,
    labels: [TRIGGERED_LABEL],
  });
}

async function doTrigger(octokit: Octokit, repository: Repository) {
  const repoUrl = repository.full_name;
  const owner = repository.owner.login;
  const repo = repository.name;
  const remoteConfiguration = await getConfig<ConfigurationOptions>(
    octokit,
    owner,
    repo,
    WELL_KNOWN_CONFIGURATION_FILE,
    {schema: schema}
  );
  if (!remoteConfiguration) {
    logger.info(`kokoro-trigger not configured for ${repoUrl}`);
    return;
  }
  const jobName = getJobName(remoteConfiguration, repository);
  if (!jobName) {
    logger.warn(`could not determine job name for ${repoUrl}`);
    return;
  }

  const releasePullRequests = await findReleasePullRequests(
    octokit,
    repository
  );
  await Promise.all(
    releasePullRequests.map(pullRequest => {
      return Promise.all([
        triggerKokoroJob(jobName, pullRequest),
        markTriggered(octokit, pullRequest),
      ]);
    })
  );
}

export = (app: Probot) => {
  // When a release is published, try to trigger the release
  app.on('release.published', async context => {
    await doTrigger(context.octokit, context.payload.repository);
  });

  // Try to trigger the job on removing the `autorelease: triggered` label.
  // This functionality is to retry a failed release.
  app.on('pull_request.unlabeled', async context => {
    const label = context.payload.label?.name;
    if (label !== TRIGGERED_LABEL) {
      logger.info(`ignoring non-autorelease label: ${label}`);
      return;
    }
    await doTrigger(context.octokit, context.payload.repository);
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
};
