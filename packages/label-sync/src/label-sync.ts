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

async function getLabels() {
  if (!labelsCache) {
    await refreshLabels();
  }
  return labelsCache;
}

async function refreshLabels() {
  const url =
    'https://github.com/googleapis/repo-automation-bots/blob/master/packages/label-sync/src/labels.json';
  const res = await request<Labels>({ url });
  labelsCache = res.data;
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
      owner === 'googleapis' &&
      repo === 'repo-automation-bots' &&
      context.payload.ref === 'refs/heads/master'
    ) {
      await refreshLabels();
      // TODO: Use the GitHub installations API to retreive this list
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
  const newLabels = await getLabels();
  const res = await github.issues.listLabelsForRepo({
    owner,
    repo,
    per_page: 100,
  });
  const oldLabels = res.data;
  const promises = new Array<Promise<unknown>>();
  newLabels.labels.forEach(l => {
    // try to find a label with the same name
    const match = oldLabels.find(
      x => x.name.toLowerCase() === l.name.toLowerCase()
    );
    if (match) {
      // check to see if the color matches
      if (match.color !== l.color) {
        console.log(
          `Updating color for ${match.name} from ${match.color} to ${l.color}.`
        );
        const p = github.issues
          .updateLabel({
            repo,
            owner,
            name: l.name,
            current_name: l.name,
            description: match.description,
            color: l.color,
          })
          .catch(e => {
            console.error(`Error updating label ${l.name} in ${owner}/${repo}`);
            console.error(e.stack);
          });
        promises.push(p);
      }
    } else {
      // there was no match, go ahead and add it
      console.log(`Creating label for ${l.name}.`);
      const p = github.issues
        .createLabel({
          repo,
          owner,
          color: l.color,
          description: l.description,
          name: l.name,
        })
        .catch(e => {
          console.error(`Error creating label ${l.name} in ${owner}/${repo}`);
          console.error(e.stack);
        });
      promises.push(p);
    }
  });

  // now clean up common labels we don't want
  const labelsToDelete = [
    'bug',
    'enhancement',
    'kokoro:force-ci',
    'kokoro: force-run',
    'kokoro: run',
    'question',
  ];
  oldLabels.forEach(l => {
    if (labelsToDelete.includes(l.name)) {
      const p = github.issues
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
      promises.push(p);
    }
  });
  await Promise.all(promises);
}
