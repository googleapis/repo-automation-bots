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
import {Application} from 'probot';
import {Datastore} from '@google-cloud/datastore';
import {mergeOnGreen} from './merge-logic';

const TABLE = 'mog-prs';
const datastore = new Datastore();
const MAX_TEST_TIME = 1000 * 60 * 60 * 6; // 6 hr.
const COMMENT_INTERVAL_LOW = 1000 * 60 * 60 * 2.941; // 2 hours and 57.5 minutes
const COMMENT_INTERVAL_HIGH = 1000 * 60 * 60 * 3.058; // 3 hours and 3.5 minutes
const MERGE_ON_GREEN_LABEL = 'automerge';
const WORKER_SIZE = 4;

interface WatchPR {
  number: number;
  repo: string;
  owner: string;
  state: 'continue' | 'stop' | 'comment';
  url: string;
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
      url,
    };
    result.push(watchPr);
  }
  return result;
};

/**
 * Removes a PR from datastore once it's been attempted to merge (i.e., checked for mergeability) for 6 hours
 * @param url type string
 * @returns void
 */
handler.removePR = async function removePR(url: string) {
  const key = datastore.key([TABLE, url]);
  await datastore.delete(key);
  console.log(`PR ${url} was removed`);
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
  app.on(['schedule.repository'], async context => {
    const watchedPRs = await handler.listPRs();
    const start = Date.now();
    console.info(`running for org ${context.payload.org}`);
    const filteredPRs = watchedPRs.filter(value => {
      return value.owner.startsWith(context.payload.org);
    });
    while (filteredPRs.length) {
      const work = filteredPRs.splice(0, WORKER_SIZE);
      await Promise.all(
        work.map(async wp => {
          console.log(`checking ${wp.url}`);
          try {
            const remove = await mergeOnGreen(
              wp.owner,
              wp.repo,
              wp.number,
              MERGE_ON_GREEN_LABEL,
              wp.state,
              context.github
            );
            if (remove || wp.state === 'stop') {
              handler.removePR(wp.url);
            }
          } catch (err) {
            console.log(`Error in merge-on-green: ${err}`);
            if (wp.state === 'stop') {
              handler.removePR(wp.url);
            }
          }
        })
      );
    }
    console.info(`mergeOnGreen check took ${Date.now() - start}ms`);
  });

  app.on('pull_request.labeled', async context => {
    // if missing the label, skip
    if (
      !context.payload.pull_request.labels.some(
        label => label.name === MERGE_ON_GREEN_LABEL
      )
    ) {
      app.log.info(
        `ignoring non-force label action (${context.payload.pull_request.labels.join(
          ', '
        )})`
      );
      return;
    }
    const prNumber = context.payload.pull_request.number;
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    console.info(`${prNumber} ${owner} ${repo}`);
    //TODO: we can likely split the database functionality into its own file and
    //import these helper functions for use in the main bot event handling.
    await handler.addPR(
      {
        number: prNumber,
        owner,
        repo,
        state: 'continue',
        url: context.payload.pull_request.html_url,
      },
      context.payload.pull_request.html_url
    );
  });
}

export = handler;
