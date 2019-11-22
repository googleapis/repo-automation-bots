/**
 * Copyright 2019 Google LLC. All Rights Reserved.
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
import { request } from 'gaxios';
import { GitHubAPI } from 'probot/lib/github';
import e = require('express');

interface Labels {
  labels: [
    {
      name: string;
      description: string;
      color: string;
    }
  ];
}

interface Repos {
  repos: [
    {
      language: string;
      repo: string;
    }
  ];
}

// Labels are fetched by reaching out to GitHub *instead* of grabbing the file
// from the local copy.  We are using the `PushEvent` to detect the change,
// meaning the file running in cloud will be older than the one on master.
let labelsCache: Labels;
async function getLabels(github: GitHubAPI) {
  if (!labelsCache) {
    await refreshLabels(github);
  }
  return labelsCache;
}

async function refreshLabels(github: GitHubAPI) {
  const data = (await github.repos.getContents({
    owner: 'sofisl',
    repo: 'repo-automation-bots',
    path: 'packages/label-sync/src/labels.json',
  })).data as { content?: string };
  labelsCache = JSON.parse(
    Buffer.from(data.content as string, 'base64').toString('utf8')
  );
}

export = (app: Application) => {
  const events = [
    'repository.created',
    'repository.transferred',
    'label.edited',
    'label.deleted',
  ];

  app.on(events, async c => {
    const { owner, repo } = c.repo();
    await reconcileLabels(c.github, owner, repo);
  });

  app.on('push', async context => {
    const { owner, repo } = context.repo();
    // TODO: Limit this to pushes that edit `labels.json`
    if (
      owner === 'sofisl' &&
      repo === 'repo-automation-bots' &&
      context.payload.ref === 'refs/heads/master'
    ) {
      await refreshLabels(context.github);
      // TODO: Use the GitHub installations API to retreive this list
      //   (also, our QA indicates there's a good chance this request isn't
      // actually working, we should use the GitHub API to fetch the content).
      const url =
        'https://raw.githubusercontent.com/googleapis/sloth/master/repos.json';
      const res = await request<Repos>({ url });
      const { repos } = res.data;
      await Promise.all(
        repos.map(r => {
          const [owner, repo] = r.repo.split('/');
          return reconcileLabels(context.github, owner, repo);
        })
      );
    }
  });
};

async function reconcileLabels(github: GitHubAPI, owner: string, repo: string) {
  const newLabels = await getLabels(github);
  const res = await github.issues.listLabelsForRepo({
    owner,
    repo,
    per_page: 100,
  });
  const oldLabels = res.data;
  const promises = new Array<Promise<unknown>>();
  for (const l of newLabels.labels) {
    // try to find a label with the same name
    const match = oldLabels.find(
      x => x.name.toLowerCase() === l.name.toLowerCase()
    );
    if (match) {
      // check to see if the color matches
      if (match.color !== l.color || match.description !== l.description) {
        console.log(
          `Updating ${match.name} from ${match.color} to ${l.color} and ${match.description} to ${l.description}.`
        );
        await github.issues
          .updateLabel({
            repo,
            owner,
            name: l.name,
            current_name: l.name,
            description: l.description,
            color: l.color,
          })
          .catch(e => {
            console.error(`Error updating label ${l.name} in ${owner}/${repo}`);
            console.error(e.stack);
          });
      }
    } else {
      // there was no match, go ahead and add it
      console.log(`Creating label for ${l.name}.`);
      await github.issues
        .createLabel({
          repo,
          owner,
          color: l.color,
          description: l.description,
          name: l.name,
        })
        .catch(e => {
          //ignores errors that are caused by two requests kicking off at the same time
          if (e.errors[0].code !== 'already_exists') {
            console.error(`Error creating label ${l.name} in ${owner}/${repo}`);
            console.error(e.stack);
          }
        });
    }
  }

  // now clean up common labels we don't want
  const labelsToDelete = [
    'bug',
    'enhancement',
    'kokoro:force-ci',
    'kokoro: force-run',
    'kokoro: run',
    'question',
  ];
  if (!Object.keys(oldLabels).length) {
    for (const l of oldLabels) {
      console.log(l.name);
      if (labelsToDelete.includes(l.name)) {
        await github.issues
          .deleteLabel({
            name: l.name,
            owner,
            repo,
          })
          .then(() => {
            console.log(`Deleted '${l.name}' from ${owner}/${repo}`);
          })
          .catch(e => {
            console.error(`Error deleting label ${l.name} in ${owner}/${repo}`);
            console.error(e.stack);
          });
      }
    }
  }
}
