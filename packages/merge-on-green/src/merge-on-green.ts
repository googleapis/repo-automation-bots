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
import {Probot, Context} from 'probot';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
import {Datastore} from '@google-cloud/datastore';
import {syncLabels} from '@google-automations/label-utils';
import {mergeOnGreen} from './merge-logic';
import {logger} from 'gcf-utils';
import {
  MERGE_ON_GREEN_LABEL,
  MERGE_ON_GREEN_LABEL_SECURE,
  MERGE_ON_GREEN_LABELS,
} from './labels';

const TABLE = 'mog-prs';
const datastore = new Datastore();
const MAX_TEST_TIME = 1000 * 60 * 60 * 6; // 6 hr.
const WORKER_SIZE = 4;

handler.allowlist = [
  'googleapis',
  'yargs',
  'googlecloudplatform',
  'google',
  'google-github-actions',
  'bcoe',
  'sofisl',
  'firebase',
];

interface DatastorePR {
  number: number;
  repo: string;
  owner: string;
  state: 'continue' | 'stop';
  branchProtection?: string[];
  label: string;
  author: string;
  url: string;
  reactionId: number;
  installationId?: number;
}

interface IncomingPR {
  number: number;
  repo: string;
  owner: string;
  branch?: string;
  state: 'continue' | 'stop';
  label: string;
  author: string;
  url: string;
  installationId?: number;
}

interface Label {
  name: string;
}

/**
 * Retrieves Query response from Datastore
 * @returns a Promise that can have any data type as it is the result of the Query, plus some standard types like the query key
 */
handler.getDatastore = async function getDatastore(installationId?: number) {
  let query = datastore.createQuery(TABLE).order('created');
  if (installationId) {
    query = query.filter('installationId', installationId);
  }
  const [prs] = await datastore.runQuery(query);
  return [prs];
};

/**
 * Transforms Query response to an array pf PRs for merge-on-green function
 * @returns an array of PRs that merge-on-green will then read, which includes the PR's
 * number, state, repo, owner and url (distinct identifier)
 */
handler.listPRs = async function listPRs(
  installationId?: number
): Promise<DatastorePR[]> {
  const [prs] = await handler.getDatastore(installationId);
  const result: DatastorePR[] = [];
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
    const watchPr: DatastorePR = {
      number: pr.number,
      repo: pr.repo,
      owner: pr.owner,
      state: state as 'continue' | 'stop',
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
  github: Octokit
) {
  try {
    await github.issues.removeLabel({
      owner,
      repo,
      issue_number: prNumber,
      name: label,
    });
  } catch (err) {
    // Ignoring 404 errors.
    if (err.status !== 404) {
      throw err;
    }
  }
  await github.reactions.deleteForIssue({
    owner,
    repo,
    issue_number: prNumber,
    reaction_id: reactionId,
  });
};

/**
 * Check if PR has been merged, closed, or unlabeled, then remove from Datastore table
 * @param owner type string
 * @param repo type string
 * @param prNumber type number
 * @param label type string
 * @param reactionId type number or null
 * @param github type githup API surface from payload
 */
handler.checkIfPRIsInvalid = async function checkIfPRIsInvalid(
  owner: string,
  repo: string,
  prNumber: number,
  label: string,
  reactionId: number,
  url: string,
  github: Octokit
) {
  let pr;
  let labels;

  try {
    pr = (
      await github.pulls.get({
        owner,
        repo,
        pull_number: prNumber,
      })
    ).data;
  } catch (err) {
    pr = undefined;
  }

  try {
    labels = (
      await github.issues.listLabelsOnIssue({
        owner,
        repo,
        issue_number: prNumber,
      })
    ).data;
  } catch (err) {
    labels = undefined;
  }

  const foundLabel = labels?.find(
    (label: Label) =>
      label.name === MERGE_ON_GREEN_LABEL ||
      label.name === MERGE_ON_GREEN_LABEL_SECURE
  );

  if (pr?.merged || pr?.state === 'closed' || !foundLabel) {
    await handler.removePR(url);
    await handler.cleanUpPullRequest(
      owner,
      repo,
      prNumber,
      label,
      reactionId,
      github
    );
  }
};

/**
 * Checks if a branch with a PR has branch protection, if not, comments on PR
 * @param owner type string
 * @param repo type string
 * @param prNumber type number
 * @param github type githup API surface from payload
 */
handler.checkForBranchProtection = async function checkForBranchProtection(
  owner: string,
  repo: string,
  prNumber: number,
  baseBranch: string | undefined,
  github: Octokit
): Promise<string[] | undefined> {
  let branchProtection: string[] | undefined;
  // Check to see if branch protection exists
  const branch = baseBranch
    ? baseBranch
    : (await github.pulls.get({owner, repo, pull_number: prNumber})).data.base
        .ref;
  try {
    branchProtection = (
      await github.repos.getBranchProtection({
        owner,
        repo,
        branch,
      })
    ).data.required_status_checks?.contexts;
    logger.info(
      `checking branch protection for ${owner}/${repo}: ${branchProtection}`
    );
    // if branch protection doesn't exist, leave a comment on the PR;
  } catch (err) {
    err.message = `Error in getting branch protection\n\n${err.message}`;
    await github.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: `Your PR doesn't have any required checks. Please add required checks to your ${branch} branch and then re-add the label. Learn more about enabling these checks here: https://help.github.com/en/github/administering-a-repository/enabling-required-status-checks.`,
    });
    logger.error(err);
  }
  return branchProtection;
};

/**
 * Adds a PR to datastore when an automerge label is added to a PR
 * @param url type string
 * @param wp type Watch PR (owner, repo, pr number, state, url)
 * @returns void
 */
handler.addPR = async function addPR(
  incomingPR: IncomingPR,
  url: string,
  github: Octokit
) {
  let branchProtection: string[] | undefined;
  try {
    branchProtection = await handler.checkForBranchProtection(
      incomingPR.owner,
      incomingPR.repo,
      incomingPR.number,
      incomingPR.branch,
      github
    );
  } catch (err) {
    err.message = `Error in getting branch protection\n\n${err.message}`;
    logger.error(err.message);
  }

  // if the owner has branch protection set up, add this PR to the Datastore table
  if (branchProtection) {
    // create a reaction. Save this reaction in the Datastore table since I don't (think)
    // it is on the pull_request payload.
    const reactionId = (
      await github.reactions.createForIssue({
        owner: incomingPR.owner,
        repo: incomingPR.repo,
        issue_number: incomingPR.number,
        content: 'eyes',
      })
    ).data.id;

    const key = datastore.key([TABLE, url]);
    const entity = {
      key,
      data: {
        created: new Date().toJSON(),
        owner: incomingPR.owner,
        repo: incomingPR.repo,
        number: incomingPR.number,
        branchProtection,
        label: incomingPR.label,
        author: incomingPR.author,
        reactionId,
        installationId: incomingPR.installationId,
      },
      method: 'upsert',
    };
    await datastore.save(entity);
    logger.metric('merge_on_green.labeled', {
      repo: `${incomingPR.owner}/${incomingPR.repo}`,
    });
  }
};

/**
 * Cleans up the Datastore table for invalid PRs (merged, closed, etc)
 * @param watchedPRs array of watched PRs
 * @param app the current application being called
 * @param context the context of the webhook payload
 * @returns void
 */
handler.cleanDatastoreTable = async function cleanDatastoreTable(
  watchedPRs: DatastorePR[],
  app: Probot,
  context: Context
) {
  while (watchedPRs.length) {
    const work = watchedPRs.splice(0, WORKER_SIZE);
    await Promise.all(
      work.map(async wp => {
        logger.info(`checking ${wp.url}, ${wp.installationId} for cleanup`);
        const github = wp.installationId
          ? await app.auth(wp.installationId)
          : context.octokit;
        await handler.checkIfPRIsInvalid(
          wp.owner,
          wp.repo,
          wp.number,
          wp.label,
          wp.reactionId,
          wp.url,
          github
        );
      })
    );
  }
};

/**
 * Calls the main MOG logic, either deletes or keeps that PR in the Datastore table
 * @param watchedPRs array of watched PRs
 * @param app the current application being called
 * @param context the context of the webhook payload
 * @returns void
 */
handler.checkPRMergeability = async function checkPRMergeability(
  watchedPRs: DatastorePR[],
  octokit: Octokit
) {
  while (watchedPRs.length) {
    const work = watchedPRs.splice(0, WORKER_SIZE);
    await Promise.all(
      work.map(async wp => {
        logger.info(`checking ${wp.url}, ${wp.installationId}`);
        try {
          const remove = await mergeOnGreen(
            wp.owner,
            wp.repo,
            wp.number,
            [MERGE_ON_GREEN_LABEL, MERGE_ON_GREEN_LABEL_SECURE],
            wp.state,
            wp.branchProtection!,
            wp.label,
            wp.author,
            octokit
          );
          if (remove || wp.state === 'stop') {
            await handler.removePR(wp.url);
            try {
              await handler.cleanUpPullRequest(
                wp.owner,
                wp.repo,
                wp.number,
                wp.label,
                wp.reactionId,
                octokit
              );
            } catch (err) {
              logger.warn(
                `Failed to delete reaction and label on ${wp.owner}/${wp.repo}/${wp.number}`
              );
            }
          }
        } catch (err) {
          err.message = `Error in merge-on-green: \n\n${err.message}`;
          logger.error(err);
        }
      })
    );
  }
};

/**
 * For a given repository, looks through all the PRs and checks to see if they have a MOG label
 * @param context the context of the webhook payload
 * @returns void
 */
handler.scanForMissingPullRequests = async function scanForMissingPullRequests(
  github: Octokit,
  org: string
) {
  // Github does not support searching the labels with 'OR'.
  // The searching for issues is considered to be an "AND" instead of an "OR" .
  const [issuesAutomergeLabel, issuesAutomergeExactLabel] = await Promise.all([
    github.paginate(github.search.issuesAndPullRequests, {
      q: `is:open is:pr user:${org} label:"${MERGE_ON_GREEN_LABEL}"`,
    }),
    github.paginate(github.search.issuesAndPullRequests, {
      q: `is:open is:pr user:${org} label:"${MERGE_ON_GREEN_LABEL_SECURE}"`,
    }),
  ]);
  for (const issue of issuesAutomergeLabel) {
    const pullRequestInDatastore = await handler.getPR(issue.html_url);
    if (!pullRequestInDatastore) {
      const ownerAndRepoArray = issue.repository_url.split('/');
      const owner = ownerAndRepoArray[ownerAndRepoArray.length - 2];
      const repo = ownerAndRepoArray[ownerAndRepoArray.length - 1];
      await handler.addPR(
        {
          number: issue.number,
          owner,
          repo,
          state: 'continue',
          url: issue.html_url,
          label: MERGE_ON_GREEN_LABEL,
          author: issue.user.login,
        },
        issue.html_url,
        github
      );
    }
  }

  for (const issue of issuesAutomergeExactLabel) {
    const pullRequestInDatastore = await handler.getPR(issue.html_url);
    if (!pullRequestInDatastore) {
      const ownerAndRepoArray = issue.repository_url.split('/');
      const owner = ownerAndRepoArray[ownerAndRepoArray.length - 2];
      const repo = ownerAndRepoArray[ownerAndRepoArray.length - 1];
      await handler.addPR(
        {
          number: issue.number,
          owner,
          repo,
          state: 'continue',
          url: issue.html_url,
          label: MERGE_ON_GREEN_LABEL_SECURE,
          author: issue.user.login,
        },
        issue.html_url,
        github
      );
    }
  }
};

// TODO: refactor into multiple function exports, this will take some work in
// gcf-utils.

/**
 * Function will run merge-on-green logic when cron job is prompted, and will remove PR from datastore after appropriate time has passed
 * Will also add a PR when appropriate label is added to PR
 * @param app type probot
 * @returns void
 */
function handler(app: Probot) {
  // This scheduled job iterates through the PR database and removes PRs
  // That are closed or do not have an applicable label anymore.
  app.on('schedule.global' as '*', async context => {
    if (context.payload.cleanUp !== true) {
      return;
    }

    logger.info('Starting clean up job');
    const watchedPRs = await handler.listPRs();
    await handler.cleanDatastoreTable(watchedPRs, app, context);
  });

  // This scheduled job looks for PRs that have an applicable label
  // but are not in the database for whatever reason (missed webhook).
  app.on('schedule.installation' as '*', async context => {
    if (context.payload.findHangingPRs !== true) {
      return;
    }

    if (!context.payload.cron_org) {
      logger.warn('Cannot look for hanging PRs for non-org installations');
      return;
    }

    const installationId = context.payload.installation.id;
    logger.info(`Looking for hanging PRs for installation: ${installationId}`);
    // we cannot search in an org without the bot installation ID, so we need
    // to divide up the cron jobs based on org
    await handler.scanForMissingPullRequests(
      context.octokit,
      context.payload.cron_org
    );
    return;
  });

  // This scheduled job is the main recurring job that attempts to merge
  // mergeable PRs.
  app.on('schedule.installation' as '*', async context => {
    if (context.payload.performMerge !== true) {
      return;
    }

    const installationId = context.payload.installation.id;
    if (!installationId) {
      logger.warn('no installation id');
      return;
    }

    logger.info(`Starting merge checks for installation: ${installationId}`);
    const watchedPRs = await handler.listPRs(installationId);
    const start = Date.now();
    await handler.checkPRMergeability(watchedPRs, context.octokit);
    logger.info(`mergeOnGreen check took ${Date.now() - start}ms`);
  });

  // This scheduled job ensures that every installed repository has the
  // merge-on-green labels created and available.
  app.on('schedule.repository' as '*', async context => {
    if (context.payload.syncLabels !== true) {
      return;
    }
    const owner = context.payload.organization.login;
    const repo = context.payload.repository.name;
    logger.info(`Starting label sync for ${owner}/${repo}`);
    await syncLabels(context.octokit, owner, repo, MERGE_ON_GREEN_LABELS);
  });

  app.on('pull_request.labeled', async context => {
    const prNumber = context.payload.pull_request.number;
    const author = context.payload.pull_request.user.login;
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const installationId = context.payload.installation?.id;

    // Limit functionality to an allowlist
    if (
      !handler.allowlist.find(
        element => element.toLowerCase() === owner.toLowerCase()
      )
    ) {
      logger.info(`skipped ${owner}/${repo} because not a part of allowlist`);
      return;
    }

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

    await handler.addPR(
      {
        number: prNumber,
        owner,
        repo,
        branch: context.payload.pull_request.base.ref,
        state: 'continue',
        url: context.payload.pull_request.html_url,
        label: label.name,
        author,
        installationId,
      },
      context.payload.pull_request.html_url,
      context.octokit
    );
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
    );

    // If the label is on the PR but the action was unlabeled, it means the PR had some other
    // label removed. No action needs to be taken.
    if (label) {
      logger.info(
        `correct label ${label.name} is still on ${repo}/${prNumber}, will continue watching`
      );
      return;
    }

    // Check to see if the PR exists in the table before trying to delete. We also
    // need to do this to get the reaction id to remove the reaction when MOG is finished.
    const watchedPullRequest: DatastorePR = await handler.getPR(
      context.payload.pull_request.html_url
    );
    logger.info(`PR from Datastore: ${JSON.stringify(watchedPullRequest)}`);
    if (watchedPullRequest) {
      await handler.removePR(context.payload.pull_request.html_url);
      await handler.cleanUpPullRequest(
        owner,
        repo,
        prNumber,
        watchedPullRequest.label,
        watchedPullRequest.reactionId,
        context.octokit
      );
    }
  });

  app.on(['pull_request.closed', 'pull_request.merged'], async context => {
    const prNumber = context.payload.pull_request.number;
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;

    // Check to see if the PR exists in the table before trying to delete. We also
    // need to do this to get the reaction id to remove the reaction when MOG is finished.
    const watchedPullRequest: DatastorePR = await handler.getPR(
      context.payload.pull_request.html_url
    );

    if (watchedPullRequest) {
      await handler.removePR(context.payload.pull_request.html_url);
      await handler.cleanUpPullRequest(
        owner,
        repo,
        prNumber,
        watchedPullRequest.label,
        watchedPullRequest.reactionId,
        context.octokit
      );
    }
  });
}

export = handler;
