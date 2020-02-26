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

import { Application } from 'probot';
import { Datastore } from '@google-cloud/datastore';
import { mergeOnGreen } from './merge-logic';

const TABLE = 'mog-prs';
const datastore = new Datastore();
const MAX_TEST_TIME = 1000 * 60 * 60 * 6; // 2 hr.
const MERGE_ON_GREEN_LABEL = 'automerge';

interface WatchPR {
  number: number;
  repo: string;
  owner: string;
  state: 'continue' | 'stop';
  url: string;
}

handler.listPRs = async function listPRs(): Promise<WatchPR[]> {
  const query = datastore.createQuery(TABLE).order('created');
  const [prs] = await datastore.runQuery(query);
  const result: WatchPR[] = [];
  for (let x = 0; x < prs.length; x += 5) {
    if (prs[x + 1] === undefined) {
      break;
    }
    const [worker1, worker2, worker3, worker4] = await Promise.all([
      prs[x],
      prs[x + 1],
      prs[x + 2],
      prs[x + 3],
      prs[x + 4],
    ]);
    const created = new Date(worker1.created).getTime();
    const now = new Date().getTime();
    const url = worker1[datastore.KEY].name;
    let state = 'continue';
    //TODO: I'd prefer to not have a "list" method that has side effects - perhaps later refactor
    //this to do the list, then have an explicit loop over the returned WatchPR objects that removes the expired ones.
    if (now - created > MAX_TEST_TIME) {
      state = 'stop';
    }
    const [watchPr1, watchPr2, watchPr3, watchPr4] = [
      {
        number: worker1.number,
        repo: worker1.repo,
        owner: worker1.owner,
        state: state as 'continue' | 'stop',
        url,
      },
      {
        number: worker2.number,
        repo: worker2.repo,
        owner: worker2.owner,
        state: state as 'continue' | 'stop',
        url,
      },
      {
        number: worker3.number,
        repo: worker3.repo,
        owner: worker3.owner,
        state: state as 'continue' | 'stop',
        url,
      },
      {
        number: worker4.number,
        repo: worker4.repo,
        owner: worker4.owner,
        state: state as 'continue' | 'stop',
        url,
      },
    ];
    result.push(watchPr1, watchPr2, watchPr3, watchPr4);
  }
  return result;
};

handler.removePR = async function removePR(url: string) {
  const key = datastore.key([TABLE, url]);
  await datastore.delete(key);
};

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
function handler(app: Application) {
  app.on(['schedule.repository'], async context => {
    const watchedPRs = await handler.listPRs();
    console.info(`running for org ${context.payload.org}`);
    for (const wp of watchedPRs) {
      const start = Date.now();
      console.info(`checking PR: ${wp.url}`);
      if (!wp.owner.startsWith(context.payload.org)) {
        console.info(
          `skipping mergeOnGreen for ${wp.url} not part of org ${context.payload.org}`
        );
        continue;
      }
      if (wp.state === 'stop') {
        console.warn(`deleting stale PR ${wp.url}`);
        await handler.removePR(wp.url);
      }
      try {
        const remove = await mergeOnGreen(
          wp.owner,
          wp.repo,
          wp.number,
          MERGE_ON_GREEN_LABEL,
          wp.state,
          context.github
        );
        if (remove && wp.state !== 'stop') {
          handler.removePR(wp.url);
        }
        console.info(`mergeOnGreen check took ${Date.now() - start}ms`);
      } catch (err) {
        console.error(err.message);
      }
    }
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
