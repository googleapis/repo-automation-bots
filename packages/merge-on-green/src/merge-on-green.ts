// Copyright 2020 Google LLC
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
import {Application, Context} from 'probot';
import {Datastore} from '@google-cloud/datastore';
import {mergeOnGreen} from './merge-logic';
import {logger} from 'gcf-utils';

const TABLE = 'mog-prs';
const datastore = new Datastore();
const MAX_TEST_TIME = 1000 * 60 * 60 * 6; // 6 hr.
const COMMENT_INTERVAL_LOW = 1000 * 60 * 60 * 3; // 3 hours
const COMMENT_INTERVAL_HIGH = 1000 * 60 * 60 * 3.067; // 3 hours and 4 minutes, the amount of time it takes Cloud Scheduler to run
//limiting this time interval makes it so that the bot will only comment once as it will only run once during the 3 to 3 hour and 4 min mark
const MERGE_ON_GREEN_LABEL = 'automerge';
const MERGE_ON_GREEN_LABEL_SECURE = 'automerge: exact';
const WORKER_SIZE = 4;

interface WatchPR {
  number: number;
  repo: string;
  owner: string;
  state: 'continue' | 'stop' | 'comment';
  branchProtection: string[];
  label: string;
  author: string;
  url: string;
  reactionId: number;
  installationId: number;
}

interface Label {
  name: string;
}

/**
 * Retrieves Query response from Datastore
 * @returns a Promise that can have any data type as it is the result of the Query, plus some standard types like the query key
 */
handler.getDatastore = async function getDatastore() {
  const query = datastore.createQuery(TABLE).order('created');
  const [prs] = await datastore.runQuery(query);
  return [prs];
};

/**
 * Transforms Query response to an array pf PRs for merge-on-green function
 * @returns an array of PRs that merge-on-green will then read, which includes the PR's
 * number, state, repo, owner and url (distinct identifier)
 */
handler.listPRs = async function listPRs(): Promise<WatchPR[]> {
  const [prs] = await handler.getDatastore();
  const result: WatchPR[] = [];
  for (const pr of prs) {
    const created = new Date(pr.created).getTime();
    const now = new Date().getTime();
    let state = 'continue';
    const url = pr[datastore.KEY]?.name;
    //TODO: I'd prefer to not have a "list" method that has side effects - perhaps later refactor
    //this to do the list, then have an explicit loop over the returned WatchPR objects that removes the expired ones.
    if (now - created > MAX_TEST_TIME) {
      state = 'stop';
    }
    if (
      now - created < COMMENT_INTERVAL_HIGH &&
      now - created > COMMENT_INTERVAL_LOW
    ) {
      state = 'comment';
    }
    const watchPr: WatchPR = {
      number: pr.number,
      repo: pr.repo,
      owner: pr.owner,
      state: state as 'continue' | 'stop' | 'comment',
      branchProtection: pr.branchProtection,
      label: pr.label,
      author: pr.author,
      reactionId: pr.reactionId,
      installationId: pr.installationId,
      url,
    };
    result.push(watchPr);
  }
  return result;
};

/**
 * Gets a PR from Datastore
 * @param url type string
 * @returns WatchPR entity
 */
handler.getPR = async function getPR(url: string) {
  const key = datastore.key([TABLE, url]);
  const [entity] = await datastore.get(key);
  return entity;
};

/**
 * Removes a PR from Datastore
 * @param url type string
 * @returns void
 */
handler.removePR = async function removePR(url: string) {
  const key = datastore.key([TABLE, url]);
  await datastore.delete(key);
  logger.info(`PR ${url} was removed`);
};

/**
 * Removes a label and reaction from a PR when it has been removed from Datastore table
 * @param owner type string
 * @param repo type string
 * @param prNumber type number
 * @param label type string
 * @param reactionId type number or null
 * @param github type githup API surface from payload
 */
handler.cleanUpPullRequest = async function cleanUpPullRequest(
  owner: string,
  repo: string,
  prNumber: number,
  label: string,
  reactionId: number,
  github: Context['github']
) {
  await github.issues
    .removeLabel({owner, repo, issue_number: prNumber, name: label})
    .catch(logger.error);
  await github.reactions
    .deleteForIssue({
      owner,
      repo,
      issue_number: prNumber,
      reaction_id: reactionId,
    })
    .catch(logger.error);
};

/**
 * Adds a PR to datastore when an automerge label is added to a PR
 * @param url type string
 * @param wp type Watch PR (owner, repo, pr number, state, url)
 * @returns void
 */
handler.addPR = async function addPR(wp: WatchPR, url: string) {
  const key = datastore.key([TABLE, url]);
  const entity = {
    key,
    data: {
      created: new Date().toJSON(),
      owner: wp.owner,
      repo: wp.repo,
      number: wp.number,
      branchProtection: wp.branchProtection,
      label: wp.label,
      author: wp.author,
      installationId: wp.installationId,
    },
    method: 'upsert',
  };
  await datastore.save(entity);
};

// TODO: refactor into multiple function exports, this will take some work in
// gcf-utils.

/**
 * Function will run merge-on-green logic when cron job is prompted, and will remove PR from datastore after appropriate time has passed
 * Will also add a PR when appropriate label is added to PR
 * @param app type probot
 * @returns void
 */
function handler(app: Application) {
  //meta-note about the schedule.repository as any; currently GH does not support this type, see
  //open issue for a fix: https://github.com/octokit/webhooks.js/issues/277
  app.on('schedule.repository' as any, async context => {
    const watchedPRs = await handler.listPRs();
    const start = Date.now();
    while (watchedPRs.length) {
      const work = watchedPRs.splice(0, WORKER_SIZE);
      await Promise.all(
        work.map(async wp => {
          logger.info(`checking ${wp.url}, ${wp.installationId}`);
          const github = wp.installationId
            ? await app.auth(wp.installationId)
            : context.github;
          try {
            const remove = await mergeOnGreen(
              wp.owner,
              wp.repo,
              wp.number,
              [MERGE_ON_GREEN_LABEL, MERGE_ON_GREEN_LABEL_SECURE],
              wp.state,
              wp.branchProtection,
              wp.label,
              wp.author,
              github as any
            );
            if (remove || wp.state === 'stop') {
              await handler.cleanUpPullRequest(
                wp.owner,
                wp.repo,
                wp.number,
                wp.label,
                wp.reactionId,
                github as any
              );
              await handler.removePR(wp.url);
            }
          } catch (err) {
            err.message = `Error in merge-on-green: \n\n${err.message}`;
            logger.error(err);
          }
        })
      );
    }
    logger.info(`mergeOnGreen check took ${Date.now() - start}ms`);
  });

  app.on('pull_request.labeled', async context => {
    const prNumber = context.payload.pull_request.number;
    const author = context.payload.pull_request.user.login;
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const installationId = context.payload.installation.id;

    const label = context.payload.pull_request.labels.find(
      (label: Label) =>
        label.name === MERGE_ON_GREEN_LABEL ||
        label.name === MERGE_ON_GREEN_LABEL_SECURE
    );

    // if missing the label, skip
    if (!label) {
      logger.info('ignoring non-MOG label');
      return;
    }

    logger.info(`${prNumber} ${owner} ${repo}`);
    //TODO: we can likely split the database functionality into its own file and
    //import these helper functions for use in the main bot event handling.

    // check our rate limit for next steps
    const rateLimit = (await context.github.rateLimit.get()).data.resources.core
      .remaining;
    if (rateLimit <= 0) {
      logger.error(
        `The rate limit is at ${rateLimit}. We are skipping execution until we reset.`
      );
      return;
    }

    // check to see if the owner has branch protection rules
    let branchProtection: string[] | undefined;
    try {
      branchProtection = (
        await context.github.repos.getBranchProtection({
          owner,
          repo,
          branch: 'master',
        })
      ).data.required_status_checks.contexts;
      logger.info(
        `checking branch protection for ${owner}/${repo}: ${branchProtection}`
      );
    } catch (err) {
      err.message = `Error in getting branch protection\n\n${err.message}`;
      await context.github.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body:
          "Your PR doesn't have any required checks. Please add required checks to your master branch and then re-add the label. Learn more about enabling these checks here: https://help.github.com/en/github/administering-a-repository/enabling-required-status-checks.",
      });
      logger.error(err);
    }

    // if the owner has branch protection set up, add this PR to the Datastore table
    if (branchProtection) {
      // try to create reaction. Save this reaction in the Datastore table since I don't (think)
      // it is on the pull_request payload.
      const reactionId = (
        await context.github.reactions.createForIssue({
          owner,
          repo,
          issue_number: prNumber,
          content: 'eyes',
        })
      ).data.id;

      await handler.addPR(
        {
          number: prNumber,
          owner,
          repo,
          state: 'continue',
          url: context.payload.pull_request.html_url,
          branchProtection: branchProtection,
          label,
          author,
          reactionId,
          installationId,
        },
        context.payload.pull_request.html_url
      );
    }
  });

  app.on(['pull_request.unlabeled'], async context => {
    const prNumber = context.payload.pull_request.number;
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;

    // check to see if the label is on the PR
    const label = context.payload.pull_request.labels.find(
      (label: Label) =>
        label.name === MERGE_ON_GREEN_LABEL ||
        label.name === MERGE_ON_GREEN_LABEL_SECURE
    )?.name;

    // If the label is on the PR but the action was unlabeled, it means the PR had some other
    // label removed. No action needs to be taken.
    if (label) {
      logger.info(
        `correct label ${label} is still on ${repo}/${prNumber}, will continue watching`
      );
      return;
    }

    // Check to see if the PR exists in the table before trying to delete. We also
    // need to do this to get the reaction id to remove the reaction when MOG is finished.
    const watchedPullRequest: WatchPR = await handler.getPR(
      context.payload.pull_request.html_url
    );
    logger.info(`PR from Datastore: ${JSON.stringify(watchedPullRequest)}`);
    if (watchedPullRequest) {
      await handler.cleanUpPullRequest(
        owner,
        repo,
        prNumber,
        watchedPullRequest.label,
        watchedPullRequest.reactionId,
        context.github
      );
      await handler.removePR(context.payload.pull_request.html_url);
    }
  });

  app.on(['pull_request.closed', 'pull_request.merged'], async context => {
    const prNumber = context.payload.pull_request.number;
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;

    // Check to see if the PR exists in the table before trying to delete. We also
    // need to do this to get the reaction id to remove the reaction when MOG is finished.
    const watchedPullRequest: WatchPR = await handler.getPR(
      context.payload.pull_request.html_url
    );
    logger.info(`PR from Datastore: ${JSON.stringify(watchedPullRequest)}`);
    if (watchedPullRequest) {
      await handler.cleanUpPullRequest(
        owner,
        repo,
        prNumber,
        watchedPullRequest.label,
        watchedPullRequest.reactionId,
        context.github
      );
      await handler.removePR(context.payload.pull_request.html_url);
    }
  });
}

export = handler;
