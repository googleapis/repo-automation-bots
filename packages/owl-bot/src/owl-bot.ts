// Copyright 2021 Google LLC
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
import admin from 'firebase-admin';
import {
  DatastoreLock,
  DatastoreLockError,
} from '@google-automations/datastore-lock';
import {FirestoreConfigsStore, Db} from './database';
// eslint-disable-next-line node/no-extraneous-import
import {Probot, Logger} from 'probot';
import {
  logger as defaultLogger,
  getAuthenticatedOctokit,
  getContextLogger,
  GCFLogger,
} from 'gcf-utils';
import {syncLabels} from '@google-automations/label-utils';
import {
  core,
  RegenerateArgs,
  parseOwlBotLock,
  CheckArgs,
  OWL_BOT_COPY,
  OPERATIONAL_DOCUMENT,
} from './core';
import {Octokit} from '@octokit/rest';
// eslint-disable-next-line node/no-extraneous-import
import {RequestError} from '@octokit/types';
import {onPostProcessorPublished, refreshConfigs} from './handlers';
import {
  PullRequestEditedEvent,
  PullRequestLabeledEvent,
} from '@octokit/webhooks-types';
import {
  OWLBOT_RUN_LABEL,
  OWL_BOT_COPY_COMMAND_LABEL,
  OWL_BOT_IGNORE,
  OWL_BOT_LABELS,
} from './labels';
import {OwlBotLock} from './config-files';
import {octokitFactoryFrom} from './octokit-util';
import {githubRepo} from './github-repo';
import {REGENERATE_CHECKBOX_TEXT} from './create-pr';
import {shouldIgnoreRepo} from './should-ignore-repo';

// We use lower case organization names here, so we need to always
// check against lower cased owner.
const ALLOWED_ORGANIZATIONS = ['googleapis', 'googlecloudplatform'];

interface PubSubContext {
  github: Octokit;
  readonly event: string;
  log: Logger;
  payload: {
    action: string;
    digest: string;
    tag: string;
  };
}

const LOCK_TIMEOUT = 25 * 1000;
class LockError extends Error {}
async function acquireLock(target: string): Promise<DatastoreLock> {
  const lock = new DatastoreLock('owlbot', target, LOCK_TIMEOUT);
  if (await lock.peek()) {
    throw new LockError();
  }
  const result = await lock.acquire();
  if (!result) {
    throw new LockError();
  }
  return lock;
}

async function releaseLock(lock: DatastoreLock): Promise<void> {
  try {
    await lock.release();
  } catch (err) {
    if (err instanceof DatastoreLockError) {
      console.warn(err);
    } else {
      throw err;
    }
  }
}

function envOrThrow(varName: string): string {
  const value = process.env[varName];
  if (!value) {
    throw Error(`must set ${varName}`);
  }
  return value;
}

function OwlBot(privateKey: string | undefined, app: Probot, db?: Db): void {
  // Fail fast if the Cloud Function doesn't have its environment configured:
  const appId = Number(envOrThrow('APP_ID'));
  const project = envOrThrow('PROJECT_ID');
  const triggers: TriggerIdsForLabels = {
    regeneratePullRequest: envOrThrow(
      'CLOUD_BUILD_TRIGGER_REGENERATE_PULL_REQUEST'
    ),
    runPostProcessor: envOrThrow('CLOUD_BUILD_TRIGGER'),
  };
  if (!privateKey) {
    throw Error('GitHub app private key must be provided');
  }

  // Initialize firestore db:
  if (!db) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.FIRESTORE_PROJECT_ID,
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    db = admin.firestore();
  }

  // We perform post processing on pull requests.  We run the specified docker container
  // on the pending pull request and push any changes back to the pull request.
  app.on(['pull_request.labeled'], async context => {
    const logger = getContextLogger(context);
    const head = context.payload.pull_request.head.repo.full_name;
    const [owner, repo] = head.split('/');
    logger.info(
      `runPostProcessor: repo=${owner}/${repo} action=${context.payload.action} sha=${context.payload.pull_request.head.sha}`
    );
    let octokit: Octokit;
    if (context.payload.installation?.id) {
      octokit = await getAuthenticatedOctokit(context.payload.installation.id);
    } else {
      throw new Error(
        `Installation ID not provided in ${context.payload.action} event.` +
          ' We cannot authenticate Octokit.'
      );
    }
    await owlbot.handlePullRequestLabeled(
      appId,
      privateKey,
      project,
      triggers,
      context.payload as PullRequestLabeledEvent,
      octokit,
      logger
    );
  });

  // Did someone click the "Regenerate this pull request" checkbox?
  app.on(['pull_request.edited'], async context => {
    const regenerate = userCheckedRegenerateBox(
      project,
      triggers.regeneratePullRequest,
      context.payload as PullRequestEditedEvent
    );
    if (regenerate) {
      const installationId = context.payload.installation?.id;
      if (!installationId) {
        throw new Error('Missing installation id.');
      }
      const octokitFactory = octokitFactoryFrom({
        'app-id': appId,
        privateKey,
        installation: installationId,
      });
      await core.triggerRegeneratePullRequest(octokitFactory, regenerate);
    }
  });

  app.on('merge_group.checks_requested' as any, async context => {
    const logger = getContextLogger(context);
    const installation = context.payload.installation?.id;
    const headSha = context.payload.merge_group.head_sha;
    const [owner, repo] = context.payload.repository.full_name.split('/');
    if (!installation) {
      throw Error(`no installation token found for ${headSha}`);
    }
    const octokit = await getAuthenticatedOctokit(installation);

    logger.info("skipping merge queue check because there's no associated PR");
    await octokit.checks.create({
      owner,
      repo,
      name: 'OwlBot Post Processor',
      summary: 'Skipping check for merge_queue',
      head_sha: headSha,
      status: 'complete',
      conclusion: 'skipped',
    });
  });

  app.on(
    [
      'pull_request.opened',
      'pull_request.synchronize',
      'pull_request.reopened',
    ],
    async context => {
      const logger = getContextLogger(context);

      if (
        context.payload.pull_request.draft &&
        !context.payload.pull_request.labels.some(
          label => label.name === OWL_BOT_COPY
        )
      ) {
        logger.info(
          `skipping draft PR ${context.payload.pull_request.issue_url}` +
            ' with labels ',
          ...context.payload.pull_request.labels
        );
        return;
      }

      const head = context.payload.pull_request.head.repo.full_name;
      const base = context.payload.pull_request.base.repo.full_name;
      const baseOwner = base.split('/')[0];
      const [owner, repo] = head.split('/');
      const installation = context.payload.installation?.id;
      const prNumber = context.payload.pull_request.number;
      const baseRef = context.payload.pull_request.base.ref;
      const defaultBranch =
        context.payload?.repository?.default_branch ?? 'main';

      if (!installation) {
        throw Error(`no installation token found for ${head}`);
      }
      const octokit = await getAuthenticatedOctokit(installation);

      // If the pull request is from a fork, the label "owlbot:run" must be
      // added by a maintainer to trigger the post processor.
      if (head !== base) {
        logger.info(`head ${head} does not match base ${base} skipping`);
        return;
      }

      // We limit the organization for running post processor.
      if (!ALLOWED_ORGANIZATIONS.includes(baseOwner.toLowerCase())) {
        logger.info(
          `base ${base} is not allowed to run the post processor, skipping`
        );
        return;
      }

      logger.info(
        `runPostProcessor: repo=${owner}/${repo} action=${context.payload.action} sha=${context.payload.pull_request.head.sha}`
      );
      await runPostProcessorWithLock(
        appId,
        privateKey,
        project,
        triggers.runPostProcessor,
        {
          head,
          base,
          baseRef,
          prNumber,
          installation,
          owner,
          repo,
          defaultBranch,
          sha: context.payload.pull_request.head.sha,
        },
        octokit,
        logger
      );
    }
  );

  // Configured to run when a new container is published to container registry:
  //
  // Probot no longer allows custom `.on` in types, so we cast to
  // any to circumvent this issue:
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.on('pubsub.message' as any, async context => {
    const logger = getContextLogger(context);
    const typedContext = context as unknown as PubSubContext;
    // TODO: flesh out tests for pubsub.message handler:
    logger.info(JSON.stringify(typedContext.payload));
    if (typedContext.payload.action === 'INSERT') {
      const configStore = new FirestoreConfigsStore(db!);
      const dockerImageDigest = typedContext.payload.digest.split('@')[1];
      const dockerImageName = typedContext.payload.tag;
      logger.info({dockerImageDigest, dockerImageName});
      await onPostProcessorPublished(
        configStore,
        privateKey,
        appId,
        dockerImageName,
        dockerImageDigest
      );
    }
  });

  // Ensure up-to-date configuration is stored on merge
  app.on('pull_request.closed', async context => {
    const logger = getContextLogger(context);
    const configStore = new FirestoreConfigsStore(db!);
    const installationId = context.payload.installation?.id;
    const org = context.payload.organization?.login;

    logger.info("Updating repo's configs via `pull_request.closed`");

    if (!installationId || !org) {
      logger.error(`Missing install id (${installationId}) or org (${org})`);
      return;
    }
    const octokit = await getAuthenticatedOctokit(installationId);

    if (shouldIgnoreRepo(context.payload.repository.full_name)) {
      logger.info(
        `Ignoring pull_request.closed for ${context.payload.repository.full_name}`
      );
      return;
    }

    const configs = await configStore.getConfigs(
      context.payload.repository.full_name
    );

    await refreshConfigs(
      configStore,
      configs,
      octokit,
      githubRepo(org, context.payload.repository.name),
      context.payload.repository.default_branch ?? 'master',
      installationId
    );
  });

  // Repository cron handler.
  // We share this handler between two cron jobs.
  // Both cron job has its own parameter.
  // See cron.yaml
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.on('schedule.repository' as any, async context => {
    const logger = getContextLogger(context);
    if (context.payload.syncLabels === true) {
      // owl-bot-sync-label cron entry
      // syncing labels
      const owner = context.payload.organization.login;
      const repo = context.payload.repository.name;
      let octokit: Octokit;
      if (context.payload.installation?.id) {
        octokit = await getAuthenticatedOctokit(
          context.payload.installation.id
        );
      } else {
        throw new Error(
          'Installation ID not provided in schedule.repository event.' +
            ' We cannot authenticate Octokit.'
        );
      }
      if (ALLOWED_ORGANIZATIONS.includes(owner.toLowerCase())) {
        await syncLabels(octokit, owner, repo, OWL_BOT_LABELS);
      } else {
        logger.info(
          `Ignoring ${owner}/${repo} because it's in the wrong organization.`
        );
      }
      return;
    }
  });
}

export interface TriggerIdsForLabels {
  runPostProcessor: string;
  regeneratePullRequest: string;
}

async function handlePullRequestLabeled(
  appId: number,
  privateKey: string,
  project: string,
  triggers: TriggerIdsForLabels,
  payload: PullRequestLabeledEvent,
  octokit: Octokit,
  logger: GCFLogger = defaultLogger
) {
  const head = payload.pull_request.head.repo.full_name;
  const base = payload.pull_request.base.repo.full_name;
  const [owner, repo] = base.split('/');
  const installation = payload.installation?.id ?? 0;
  const prNumber = payload.pull_request.number;

  if (!installation) {
    throw Error(`no installation token found for ${head}`);
  }

  // We limit the organization for running post processor.
  if (!ALLOWED_ORGANIZATIONS.includes(owner.toLowerCase())) {
    logger.info(`base ${base} is not allowed to invoke Owl Bot, skipping`);
    return;
  }

  function removeNewLabel() {
    return removeOwlBotLabel(
      owner,
      repo,
      prNumber,
      octokit,
      payload.label.name,
      logger
    );
  }

  async function runPostProcessorIfNotInfiniteLoop() {
    // If the last commit made to the PR was already from OwlBot, and the label
    // has been added by a bot account (most likely trusted contributor bot)
    // do not run the post processor:
    if (
      isBotAccount(payload.sender.login) &&
      (await core.lastCommitFromOwlBotPostProcessor(
        owner,
        repo,
        prNumber,
        octokit
      ))
    ) {
      logger.info(
        `skipping post-processor run for ${owner}/${repo} pr = ${prNumber} to avoid an infinite loop`
      );
      return;
    }

    // If label is explicitly added, run as if PR is made against default branch:
    const defaultBranch = payload?.repository?.default_branch;
    await runPostProcessorWithLock(
      appId,
      privateKey,
      project,
      triggers.runPostProcessor,
      {
        head,
        base,
        baseRef: defaultBranch,
        prNumber,
        installation,
        owner,
        repo,
        defaultBranch,
        sha: payload.pull_request.head.sha,
      },
      octokit,
      logger,
      isBotAccount(payload.sender.login)
    );
    logger.metric('owlbot.run_post_processor');
  }

  if (payload.pull_request.draft && payload.label.name === OWL_BOT_COPY) {
    await runPostProcessorIfNotInfiniteLoop();
  } else if (payload.label.name === OWLBOT_RUN_LABEL) {
    await removeNewLabel();
    await runPostProcessorIfNotInfiniteLoop();
  } else if (payload.label.name === OWL_BOT_COPY_COMMAND_LABEL) {
    // Owl Bot Bootstrapper requested Owl Bot to copy code from googleapis-gen.
    await removeNewLabel();
    const octokitFactory = octokitFactoryFrom({
      'app-id': appId,
      privateKey,
      installation,
    });
    await core.triggerRegeneratePullRequest(octokitFactory, {
      branch: payload.pull_request.head.ref,
      gcpProjectId: project,
      owner,
      prNumber,
      buildTriggerId: triggers.regeneratePullRequest,
      repo,
      action: 'append',
    });
  } else {
    logger.info(
      `skipping non-owlbot label: ${payload.label.name} ${head} for ${base}`
    );
  }
}

/*
 * Remove owl:bot label, ignoring errors caused by label already being removed.
 *
 * @param {string} owner - org of PR.
 * @param {string} repo - repo of PR.
 * @param {number} repo - PR number.
 */
async function removeOwlBotLabel(
  owner: string,
  repo: string,
  prNumber: number,
  octokit: Octokit,
  label: string,
  logger: GCFLogger
): Promise<void> {
  try {
    await octokit.issues.removeLabel({
      name: label,
      issue_number: prNumber,
      owner,
      repo,
    });
  } catch (e) {
    const err = e as RequestError & Error;
    if (err.status === 404) {
      logger.warn(`${err.message} head = ${owner}/${repo} pr = ${prNumber}`);
    } else {
      throw err;
    }
  }
}

/*
 * Return whether or not the sender that triggered this event
 * is a bot account.
 *
 * @param {string} sender - user that triggered event.
 * @returns boolean whether or not sender was bot.
 */
function isBotAccount(sender: string): boolean {
  // GitHub apps have a [bot] suffix on their sender name, e.g.,
  // google-cla[bot].
  return /.*\[bot]$/.test(sender);
}

async function runPostProcessorWithLock(
  appId: number,
  privateKey: string,
  project: string,
  trigger: string,
  opts: RunPostProcessorOpts,
  octokit: Octokit,
  logger: GCFLogger,
  breakLoop = true
) {
  // Short-circuit if post-processor already running for this SHA, preventing two post-processor images
  // from both executing and pushing changes against the same PR.
  const target = `${opts.owner}_${opts.repo}_${opts.sha}`;
  let lock: DatastoreLock;
  try {
    lock = await owlbot.acquireLock(target);
  } catch (err) {
    if (err instanceof LockError) {
      logger.info(
        `acquireLock failed: target=${target} - post processor is likely already running from another trigger`
      );
      return;
    } else {
      logger.warn(`Error acquiring datastore lock for target ${target}`, err);
      logger.warn(err as any);
      throw err;
    }
  }

  try {
    return await runPostProcessor(
      appId,
      privateKey,
      project,
      trigger,
      opts,
      octokit,
      logger,
      breakLoop
    );
  } finally {
    await releaseLock(lock);
  }
}

interface RunPostProcessorOpts {
  head: string;
  base: string;
  baseRef: string;
  prNumber: number;
  installation: number;
  owner: string;
  repo: string;
  sha: string;
  defaultBranch?: string;
}
const runPostProcessor = async (
  appId: number,
  privateKey: string,
  project: string,
  trigger: string,
  opts: RunPostProcessorOpts,
  octokit: Octokit,
  logger: GCFLogger,
  breakLoop = true
) => {
  // Fetch the .Owlbot.lock.yaml from head of PR:
  let lock: OwlBotLock | undefined = undefined;
  async function createCheck(
    args: Pick<CheckArgs, 'text' | 'summary' | 'conclusion' | 'title'> &
      Pick<Partial<CheckArgs>, 'detailsURL'>
  ): Promise<void> {
    // Also log the check for easier debugging.
    const logLine = `GitHub check for https://github.com/${opts.base}/pull/${opts.prNumber}
  ${args.title}
  ${args.summary}
  ${args.text}
  ${args.conclusion}
`;
    try {
      await core.createCheck(
        {
          privateKey: privateKey,
          appId: appId,
          installation: opts.installation,
          pr: opts.prNumber,
          repo: opts.base,
          detailsURL:
            'https://github.com/googleapis/repo-automation-bots/tree/master/packages/owl-bot',
          ...args,
        },
        octokit,
        logger
      );
    } catch (e) {
      logger.error(`Failed to create ${logLine}${e}`);
      return;
    }
    logger.info(`Created ${logLine}`);
  }

  // Attempt to load the OwlBot lock file for a repository, if the lock
  // file is corrupt an error will be thrown and we should show a failing
  // status:
  let lockText: string | undefined = undefined;
  try {
    lockText = await core.fetchOwlBotLock(opts.base, opts.prNumber, octokit);
  } catch (e) {
    await createCheck({
      text: `${String(e)}. ${OPERATIONAL_DOCUMENT}`,
      summary: 'Failed to fetch the lock file',
      conclusion: 'failure',
      title: '🦉 OwlBot - failure',
    });
    return;
  }
  if (!lockText) {
    // If OwlBot is not configured on a repo, skip creating the check.
    logger.info(
      `no .OwlBot.lock.yaml found for ${opts.head}, skip creating the check.`
    );
    return;
  }
  try {
    lock = parseOwlBotLock(lockText);
  } catch (e) {
    await createCheck({
      text: `${String(e)}. ${OPERATIONAL_DOCUMENT}`,
      summary: 'The OwlBot lock file on this repository is corrupt',
      conclusion: 'failure',
      title: '🦉 OwlBot - failure',
    });
    return;
  }

  // Only run post processor if PR is against primary branch.
  // TODO: extend on this logic to handle pre-release branches.
  if (opts.baseRef !== opts.defaultBranch) {
    logger.info(`${opts.baseRef} !== ${opts.defaultBranch}`);
    await createCheck({
      text: 'Ignored by Owl Bot because of PR against non-default branch',
      summary: 'Ignored by Owl Bot because of PR against non-default branch',
      conclusion: 'success',
      title: '🦉 OwlBot - non-default branch',
    });
    return;
  }

  // Detect looping OwlBot behavior and break the cycle:
  if (
    breakLoop &&
    (await core.hasOwlBotLoop(opts.owner, opts.repo, opts.prNumber, octokit))
  ) {
    const message = `Too many OwlBot updates created in a row for ${opts.owner}/${opts.repo}`;
    logger.warn(message);

    await createCheck({
      text: `${message}. ${OPERATIONAL_DOCUMENT}`,
      summary: message,
      conclusion: 'failure',
      title: '🦉 OwlBot - failure',
    });
    return;
  }
  const image = `${lock.docker.image}@${lock.docker.digest}`;
  // Run time image from .Owlbot.lock.yaml on Cloud Build:
  const buildStatus = await core.triggerPostProcessBuild(
    {
      image,
      project,
      privateKey,
      appId,
      installation: opts.installation,
      repo: opts.base,
      pr: opts.prNumber,
      trigger,
      defaultBranch: opts.defaultBranch,
    },
    octokit,
    logger
  );

  if (null === buildStatus) {
    // Update pull request with status of job:
    await createCheck({
      text: `Ignored by Owl Bot because of ${OWL_BOT_IGNORE} label. ${OPERATIONAL_DOCUMENT}`,
      summary: `Ignored by Owl Bot because of ${OWL_BOT_IGNORE} label`,
      conclusion: 'success',
      title: '🦉 OwlBot - ignored',
    });
    return;
  }

  // Update pull request with status of job:
  await createCheck({
    text: `${buildStatus.text} ${OPERATIONAL_DOCUMENT}`,
    summary: buildStatus.summary,
    conclusion: buildStatus.conclusion,
    title: `🦉 OwlBot - ${buildStatus.summary}`,
    detailsURL: buildStatus.detailsURL,
  });

  await core.updatePullRequestAfterPostProcessor(
    opts.owner,
    opts.repo,
    opts.prNumber,
    octokit,
    logger
  );
};

/**
 * Invoked when someone edits the title of body of a pull request.
 * We're interested if they checked the box to "regenerate this pull request."
 * Returns null if the box was not checked.
 */
function userCheckedRegenerateBox(
  project: string,
  trigger: string,
  payload: PullRequestEditedEvent,
  logger = console
): RegenerateArgs | null {
  const base = payload.pull_request.base.repo.full_name;
  const [owner, repo] = base.split('/');
  const prNumber = payload.pull_request.number;

  const newBody = payload.pull_request.body ?? '';
  const oldBody = payload.changes.body?.from ?? '';

  if (
    oldBody.includes(REGENERATE_CHECKBOX_TEXT) ||
    !newBody.includes(REGENERATE_CHECKBOX_TEXT)
  ) {
    logger.info(
      `The user didn't check the regenerate me box for PR #${prNumber}`
    );
    return null;
  }

  logger.info(`The user checked the regenerate me box for PR #${prNumber}`);

  return {
    owner,
    repo,
    prNumber,
    gcpProjectId: project,
    buildTriggerId: trigger,
    branch: payload.pull_request.head.ref,
    action: 'regenerate',
  };
}

export const owlbot = {
  acquireLock,
  handlePullRequestLabeled,
  LockError,
  OwlBot,
  userCheckedRegenerateBox,
};
