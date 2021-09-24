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
import {FirestoreConfigsStore, Db} from './database';
// eslint-disable-next-line node/no-extraneous-import
import {Probot, Logger} from 'probot';
import {logger} from 'gcf-utils';
import {syncLabels} from '@google-automations/label-utils';
import {core, RegenerateArgs} from './core';
import {Octokit} from '@octokit/rest';
// eslint-disable-next-line node/no-extraneous-import
import {RequestError} from '@octokit/types';
import {onPostProcessorPublished, refreshConfigs} from './handlers';
import {
  PullRequestEditedEvent,
  PullRequestLabeledEvent,
} from '@octokit/webhooks-types';
import {OWLBOT_RUN_LABEL, OWL_BOT_IGNORE, OWL_BOT_LABELS} from './labels';
import {OwlBotLock} from './config-files';
import {octokitFactoryFrom} from './octokit-util';
import {REGENERATE_CHECKBOX_TEXT} from './copy-code';

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

export function OwlBot(
  privateKey: string | undefined,
  app: Probot,
  db?: Db
): void {
  // Fail fast if the Cloud Function doesn't have its environment configured:
  if (!process.env.APP_ID) {
    throw Error('must set APP_ID');
  }
  const appId = Number(process.env.APP_ID);
  if (!process.env.PROJECT_ID) {
    throw Error('must set PROJECT_ID');
  }
  const project: string = process.env.PROJECT_ID;
  if (!process.env.CLOUD_BUILD_TRIGGER) {
    throw Error('must set CLOUD_BUILD_TRIGGER');
  }
  const trigger: string = process.env.CLOUD_BUILD_TRIGGER;
  const trigger_regenerate_pull_request =
    process.env.CLOUD_BUILD_TRIGGER_REGENERATE_PULL_REQUEST ?? '';
  if (!trigger_regenerate_pull_request) {
    throw Error('must set CLOUD_BUILD_TRIGGER_REGENERATE_PULL_REQUEST');
  }
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
    await exports.handlePullRequestLabeled(
      appId,
      privateKey,
      project,
      trigger,
      context.payload,
      context.octokit
    );
  });

  // Did someone click the "Regenerate this pull request" checkbox?
  app.on(['pull_request.edited'], async context => {
    const regenerate = userCheckedRegenerateBox(
      project,
      trigger_regenerate_pull_request,
      context.payload
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

  app.on(
    [
      'pull_request.opened',
      'pull_request.synchronize',
      'pull_request.reopened',
    ],
    async context => {
      const head = context.payload.pull_request.head.repo.full_name;
      const base = context.payload.pull_request.base.repo.full_name;
      const [owner, repo] = head.split('/');
      const installation = context.payload.installation?.id;
      const prNumber = context.payload.pull_request.number;

      if (!installation) {
        throw Error(`no installation token found for ${head}`);
      }

      // If the pull request is from a fork, the label "owlbot:run" must be
      // added by a maintainer to trigger the post processor.
      if (head !== base) {
        logger.info(`head ${head} does not match base ${base} skipping`);
        return;
      }

      await runPostProcessor(
        appId,
        privateKey,
        project,
        trigger,
        {
          head,
          base,
          prNumber,
          installation,
          owner,
          repo,
          defaultBranch: context.payload?.repository?.default_branch,
        },
        context.octokit
      );
    }
  );

  // Configured to run when a new container is published to container registry:
  //
  // Probot no longer allows custom `.on` in types, so we cast to
  // any to circumvent this issue:
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.on('pubsub.message' as any, async context => {
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
    const configStore = new FirestoreConfigsStore(db!);
    const installationId = context.payload.installation?.id;
    const org = context.payload.organization?.login;

    logger.info("Updating repo's configs via `pull_request.closed`");

    if (!installationId || !org) {
      logger.error(`Missing install id (${installationId}) or org (${org})`);
      return;
    }

    const configs = await configStore.getConfigs(
      context.payload.repository.full_name
    );

    await refreshConfigs(
      configStore,
      configs,
      context.octokit,
      org,
      context.payload.repository.name,
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
    if (context.payload.syncLabels === true) {
      // owl-bot-sync-label cron entry
      // syncing labels
      const owner = context.payload.organization.login;
      const repo = context.payload.repository.name;
      await syncLabels(context.octokit, owner, repo, OWL_BOT_LABELS);
      return;
    }
  });
}

export async function handlePullRequestLabeled(
  appId: number,
  privateKey: string,
  project: string,
  trigger: string,
  payload: PullRequestLabeledEvent,
  octokit: Octokit
) {
  const head = payload.pull_request.head.repo.full_name;
  const base = payload.pull_request.base.repo.full_name;
  const [owner, repo] = base.split('/');
  const installation = payload.installation?.id;
  const prNumber = payload.pull_request.number;

  if (!installation) {
    throw Error(`no installation token found for ${head}`);
  }

  const hasRunLabel = !!payload.pull_request.labels.filter(
    l => l.name === OWLBOT_RUN_LABEL
  ).length;

  // Only run post-processor if appropriate label added:
  if (!hasRunLabel) {
    logger.info(
      `skipping labels ${payload.pull_request.labels
        .map(l => l.name)
        .join(', ')} ${head} for ${base}`
    );
    return;
  }

  // Remove run label before continuing
  await removeOwlBotRunLabel(owner, repo, prNumber, octokit);

  // If the last commit made to the PR was already from OwlBot, and the label
  // has been added by a bot account (most likely trusted contributor bot)
  // do not run the post processor:
  if (
    isBotAccount(payload.sender.login) &&
    (await core.lastCommitFromOwlBot(owner, repo, prNumber, octokit))
  ) {
    logger.info(
      `skipping post-processor run for ${owner}/${repo} pr = ${prNumber}`
    );
    return;
  }

  await runPostProcessor(
    appId,
    privateKey,
    project,
    trigger,
    {
      head,
      base,
      prNumber,
      installation,
      owner,
      repo,
      defaultBranch: payload?.repository?.default_branch,
    },
    octokit,
    isBotAccount(payload.sender.login) ? true : false
  );
  logger.metric('owlbot.run_post_processor');
}

/*
 * Remove owl:bot label, ignoring errors caused by label already being removed.
 *
 * @param {string} owner - org of PR.
 * @param {string} repo - repo of PR.
 * @param {number} repo - PR number.
 */
async function removeOwlBotRunLabel(
  owner: string,
  repo: string,
  prNumber: number,
  octokit: Octokit
) {
  try {
    await octokit.issues.removeLabel({
      name: OWLBOT_RUN_LABEL,
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

interface RunPostProcessorOpts {
  head: string;
  base: string;
  prNumber: number;
  installation: number;
  owner: string;
  repo: string;
  defaultBranch?: string;
}
const runPostProcessor = async (
  appId: number,
  privateKey: string,
  project: string,
  trigger: string,
  opts: RunPostProcessorOpts,
  octokit: Octokit,
  breakLoop = true
) => {
  // Fetch the .Owlbot.lock.yaml from head of PR:
  let lock: OwlBotLock | undefined = undefined;
  // Attempt to load the OwlBot lock file for a repository, if the lock
  // file is corrupt an error will be thrown and we should show a failing
  // status:
  try {
    lock = await core.getOwlBotLock(opts.base, opts.prNumber, octokit);
  } catch (e) {
    const err = e as Error;
    await core.createCheck(
      {
        privateKey,
        appId,
        installation: opts.installation,
        pr: opts.prNumber,
        repo: opts.base,
        text: err.message,
        summary: 'The OwlBot lock file on this repository is corrupt',
        conclusion: 'failure',
        title: '🦉 OwlBot - failure',
        detailsURL:
          'https://github.com/googleapis/repo-automation-bots/tree/master/packages/owl-bot',
      },
      octokit
    );
    return;
  }
  if (!lock) {
    logger.info(`no .OwlBot.lock.yaml found for ${opts.head}`);
    // If OwlBot is not configured on repo, indicate success. This makes
    // it easier to enable OwlBot as a required check during migration:
    await core.createCheck(
      {
        privateKey,
        appId,
        installation: opts.installation,
        pr: opts.prNumber,
        repo: opts.base,
        text: 'OwlBot is not yet enabled on this repository',
        summary: 'OwlBot is not yet enabled on this repository',
        conclusion: 'success',
        title: '🦉 OwlBot - success',
        detailsURL:
          'https://github.com/googleapis/repo-automation-bots/tree/master/packages/owl-bot',
      },
      octokit
    );
    return;
  }
  // Detect looping OwlBot behavior and break the cycle:
  if (
    breakLoop &&
    (await core.hasOwlBotLoop(opts.owner, opts.repo, opts.prNumber, octokit))
  ) {
    const message = `Too many OwlBot updates created in a row for ${opts.owner}/${opts.repo}`;
    logger.warn(message);

    await core.createCheck(
      {
        privateKey,
        appId,
        installation: opts.installation,
        pr: opts.prNumber,
        repo: opts.base,
        text: message,
        summary: message,
        conclusion: 'failure',
        title: '🦉 OwlBot - failure',
        detailsURL:
          'https://github.com/googleapis/repo-automation-bots/tree/master/packages/owl-bot',
      },
      octokit
    );
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
    octokit
  );

  if (null === buildStatus) {
    // Update pull request with status of job:
    await core.createCheck(
      {
        privateKey,
        appId,
        installation: opts.installation,
        pr: opts.prNumber,
        repo: opts.base,
        text: `Ignored by Owl Bot because of ${OWL_BOT_IGNORE} label`,
        summary: `Ignored by Owl Bot because of ${OWL_BOT_IGNORE} label`,
        conclusion: 'success',
        title: '🦉 OwlBot - ignored',
        detailsURL:
          'https://github.com/googleapis/repo-automation-bots/blob/main/packages/owl-bot/README.md',
      },
      octokit
    );
    return;
  }

  // Update pull request with status of job:
  await core.createCheck(
    {
      privateKey,
      appId,
      installation: opts.installation,
      pr: opts.prNumber,
      repo: opts.base,
      text: buildStatus.text,
      summary: buildStatus.summary,
      conclusion: buildStatus.conclusion,
      title: `🦉 OwlBot - ${buildStatus.summary}`,
      detailsURL: buildStatus.detailsURL,
    },
    octokit
  );

  await core.updatePullRequestAfterPostProcessor(
    opts.owner,
    opts.repo,
    opts.prNumber,
    octokit
  );
};

/**
 * Invoked when someone edits the title of body of a pull request.
 * We're interested if they checked the box to "regenerate this pull request."
 * Returns null if the box was not checked.
 */
export function userCheckedRegenerateBox(
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
    prBody: newBody,
    gcpProjectId: project,
    buildTriggerId: trigger,
    branch: payload.pull_request.head.ref,
  };
}
