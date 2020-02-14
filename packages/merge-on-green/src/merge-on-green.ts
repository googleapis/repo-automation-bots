/**
 * Copyright 2020 Google LLC. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Application } from 'probot';
import { Datastore } from '@google-cloud/datastore';
import { mergeOnGreen } from './merge-logic';

const TABLE = 'mog-prs';
const datastore = new Datastore();
const MAX_TEST_TIME = 1000 * 60 * 60 * 2; // 2 hr.
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
  for (const pr of prs) {
    const created = new Date(pr.created).getTime();
    const now = new Date().getTime();
    console.info(`keystore data`, pr[datastore.KEY]);
    const url = pr[datastore.KEY].name;
    let state = 'continue';
    if (now - created > MAX_TEST_TIME) {
      console.warn(`deleting stale PR ${url}`);
      await handler.removePR(url);
      state = 'stop';
    }
    const watchPr: WatchPR = {
      number: pr.number,
      repo: pr.repo,
      owner: pr.owner,
      state: state as 'continue' | 'stop',
      url,
    };
    result.push(watchPr);
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
    for (const wp of watchedPRs) {
      console.info(`watchedPR ${JSON.stringify(wp, null, 2)}`);
      try {
        const remove = await mergeOnGreen(
          wp.owner,
          wp.repo,
          wp.number,
          MERGE_ON_GREEN_LABEL,
          wp.state,
          context.github
        );
        if (remove) {
          handler.removePR(wp.url);
        }
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
