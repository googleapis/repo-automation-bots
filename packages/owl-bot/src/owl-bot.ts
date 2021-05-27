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
import {core} from './core';
import {Octokit} from '@octokit/rest';
import {onPostProcessorPublished, scanGithubForConfigs} from './handlers';
import {PullRequestLabeledEvent} from '@octokit/webhooks-types';

const OWLBOT_RUN_LABEL = 'owlbot:run';

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
  app.on('pubsub.message' as any, async (context: PubSubContext) => {
    // TODO: flesh out tests for pubsub.message handler:
    logger.info(JSON.stringify(context.payload));
    if (context.payload.action === 'INSERT') {
      const configStore = new FirestoreConfigsStore(db!);
      const dockerImageDigest = context.payload.digest.split('@')[1];
      const dockerImageName = context.payload.tag;
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

  // Run periodically, to ensure that up-to-date configuration is stored
  // for repositories:
  app.on('schedule.repository' as '*', async context => {
    const configStore = new FirestoreConfigsStore(db!);
    logger.info(
      `scan ${context.payload.org} istallation = ${context.payload.installation.id}`
    );
    await scanGithubForConfigs(
      configStore,
      context.octokit,
      context.payload.org,
      Number(context.payload.installation.id)
    );
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
    octokit
  );

  try {
    await octokit.issues.removeLabel({
      name: OWLBOT_RUN_LABEL,
      issue_number: prNumber,
      owner,
      repo,
    });
  } catch (err) {
    if (err.status === 404) {
      logger.warn(`${err.message} head = ${head} pr = ${prNumber}`);
    } else {
      throw err;
    }
  }
  logger.metric('owlbot.run_post_processor');
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
  octokit: Octokit
) => {
  // Detect looping OwlBot behavior and break the cycle:
  if (await core.hasOwlBotLoop(opts.owner, opts.repo, opts.prNumber, octokit)) {
    throw Error(
      `too many OwlBot updates created in a row for ${opts.owner}/${opts.repo}`
    );
  }
  // Fetch the .Owlbot.lock.yaml from the head ref:
  const lock = await core.getOwlBotLock(opts.base, opts.prNumber, octokit);
  if (!lock) {
    logger.info(`no .OwlBot.lock.yaml found for ${opts.head}`);
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
