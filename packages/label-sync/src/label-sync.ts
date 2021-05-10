// Copyright 2019 Google LLC
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
import {createHash} from 'crypto';
import {Storage} from '@google-cloud/storage';
import * as util from 'util';
import {logger} from 'gcf-utils';
import {request} from 'gaxios';

const storage = new Storage();

export interface ConfigurationOptions {
  ignored?: boolean;
}

const CONFIGURATION_FILE = 'label-sync.yml';

interface Labels {
  labels: [
    {
      name: string;
      description: string;
      color: string;
    }
  ];
}

interface Repo {
  full_name: string;
}

// Labels are fetched by reaching out to GitHub *instead* of grabbing the file
// from the local copy.  We are using the `PushEvent` to detect the change,
// meaning the file running in cloud will be older than the one on master.
let labelsCache: Labels;
async function getLabels(repoPath: string): Promise<Labels> {
  if (!labelsCache) {
    await refreshLabels();
  }
  const labels = {
    labels: labelsCache.labels.slice(0),
  } as Labels;
  const apiLabelsRes = await getApiLabels(repoPath);
  apiLabelsRes.apis.forEach(api => {
    if (!api.github_label || !api.api_shortname) {
      logger.error(`
        Missing expected fields for a given API label returned from GCS.
        This object was expected to have a 'github_label' and 'api_shortname'
        property, but it is missing at least one of them.`);
      logger.error(util.inspect(api));
      return;
    }
    labels.labels.push({
      name: api.github_label,
      description: `Issues related to the ${api.display_name} API.`,
      color: createHash('md5')
        .update(api.api_shortname)
        .digest('hex')
        .slice(0, 6),
    });
  });
  return labels;
}

/**
 * Fetch the list of static labels from this repository, and cache it.
 * Note: this method uses gaxios and a direct HTTP request as opposed to
 * an API call through octokit on purpose :) The GitHub API requires specific
 * permissions to access content in a repository.
 */
async function refreshLabels() {
  const url =
    'https://raw.githubusercontent.com/googleapis/repo-automation-bots/master/packages/label-sync/src/labels.json';
  const res = await request<Labels>({url});
  labelsCache = res.data;
}

export function handler(app: Probot) {
  app.on(
    [
      'repository.created',
      'repository.transferred',
      'label.edited',
      'label.deleted',
    ],
    async c => {
      const [owner, repo] = c.payload.repository.full_name.split('/');

      // Allow the label sync logic to be ignored for a repository.
      // Since there's a feature for ignoring, it should skip the repo
      // when failed to fetch the config.
      let remoteConfiguration: ConfigurationOptions | null = null;
      try {
        remoteConfiguration = await loadConfig(c);
      } catch (err) {
        err.message =
          'Error reading configuration for ' +
          `${c.payload.repository.full_name}, skipping: ${err.message}`;
        logger.error(err);
        return;
      }
      if (remoteConfiguration?.ignored) {
        logger.info(`skipping repository ${c.payload.repository.full_name}`);
        return;
      }

      await reconcileLabels(c.octokit, owner, repo);
    }
  );

  app.on('schedule.repository' as any, async c => {
    const owner = c.payload.organization.login;
    const repo = c.payload.repository.name;

    // Allow the label sync logic to be ignored for a repository.
    // Since there's a feature for ignoring, it should skip the repo
    // when failed to fetch the config.
    let remoteConfiguration: ConfigurationOptions | null = null;
    try {
      remoteConfiguration = await loadConfig(c);
    } catch (err) {
      err.message =
        'Error reading configuration for ' +
        `${c.payload.repository.full_name}, skipping: ${err.message}`;
      logger.error(err);
      return;
    }
    if (remoteConfiguration?.ignored) {
      logger.info(`skipping repository ${c.payload.repository.full_name}`);
      return;
    }

    logger.info(`running for org ${c.payload.cron_org}`);

    if (c.payload.cron_org !== owner) {
      logger.info(`skipping run for ${c.payload.cron_org}`);
      return;
    }

    await reconcileLabels(c.octokit, owner, repo);
  });

  app.on('installation_repositories.added', async c => {
    await Promise.all(
      c.payload.repositories_added.map((r: Repo) => {
        const [owner, repo] = r.full_name.split('/');
        return reconcileLabels(c.octokit, owner, repo);
      })
    );
  });
}

/*
 * Fetch remote configuration.
 * @param probot context.
 *
 */
export const loadConfig = async (context: Context) => {
  return (await context.config(
    CONFIGURATION_FILE
  )) as ConfigurationOptions | null;
};

interface GetApiLabelsResponse {
  apis: Array<{
    display_name: string; // Access Approval
    github_label: string; // api: accessapproval
    api_shortname: string; // accessapproval
  }>;
}

interface PublicReposResponse {
  repos: Array<{
    repo: string;
    github_label: string;
  }>;
}

/**
 * Reach out to GCS and get a list of all available repositories and products.
 * For split repositories, only add the `api: product` label for that specific
 * product.  For monorepos, add an `api: product` label for all available
 * products.  Return the list of labels that should be added.
 * @param repoPath
 */
export const getApiLabels = async (
  repoPath: string
): Promise<GetApiLabelsResponse> => {
  const publicRepos = await storage
    .bucket('devrel-prod-settings')
    .file('public_repos.json')
    .download();
  const {repos}: PublicReposResponse = JSON.parse(publicRepos[0].toString());
  const repo = repos.find(r => r.repo === repoPath && r.github_label !== '');

  if (repo) {
    // for split-repos we populate only the label associated with the
    // product the repo is associated with:
    logger.info(`populating ${repo.github_label} label for ${repoPath}`);
    return {
      apis: [
        {
          github_label: repo.github_label,
          api_shortname: repoPath.split('/')[1],
          display_name: repoPath,
        },
      ],
    };
  }
  // for mono-repos we populate a list of all apis and products,
  // since each repo might include multiple products:
  logger.info(`populating all api labels for ${repoPath}`);
  const apis = await storage
    .bucket('devrel-prod-settings')
    .file('apis.json')
    .download();
  const parsedResponse = JSON.parse(apis[0].toString()) as GetApiLabelsResponse;
  logger.info(`Detected ${parsedResponse.apis.length} API labels from DRIFT.`);
  return parsedResponse;
};

/**
 * Main method. Fetch a list of required labels, and apply them to a given
 * repository.
 */
async function reconcileLabels(
  github: Context['octokit'],
  owner: string,
  repo: string
) {
  const newLabels = await getLabels(`${owner}/${repo}`);
  const oldLabels = await github.paginate(github.issues.listLabelsForRepo, {
    owner,
    repo,
    per_page: 100,
  });
  for (const l of newLabels.labels) {
    // try to find a label with the same name
    const match = oldLabels.find(
      x => x.name.toLowerCase() === l.name.toLowerCase()
    );
    if (match) {
      // check to see if the color matches
      if (match.color !== l.color || match.description !== l.description) {
        logger.info(
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
            e.message = `Error updating label ${l.name} in ${owner}/${repo}\n\n${e.message}`;
            logger.error(e);
          });
      }
    } else {
      // there was no match, go ahead and add it
      logger.info(`Creating label for ${l.name}.`);
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
          if (
            !Array.isArray(e.errors) ||
            e.errors[0].code !== 'already_exists'
          ) {
            e.message = `Error creating label ${l.name} in ${owner}/${repo}\n\n${e.message}`;
            logger.error(e);
          }
        });
    }
  }

  // now clean up common labels we don't want
  const labelsToDelete = [
    'bug', // prefer type: bug
    'enhancement', // type: feature request
    'question', // type: question
    'kokoro:force-ci', // just wrong
    'kokoro: force-run', // errornous spaces
    'kokoro: run',
    'buildcop: issue', // flakybot is the new name
    'buildcop: quiet',
    'buildcop: flaky',
  ];
  for (const l of oldLabels) {
    if (labelsToDelete.includes(l.name)) {
      await github.issues
        .deleteLabel({
          name: l.name,
          owner,
          repo,
        })
        .then(() => {
          logger.info(`Deleted '${l.name}' from ${owner}/${repo}`);
        })
        .catch(e => {
          e.message = `Error deleting label ${l.name} in ${owner}/${repo}\n\n${e.message}`;
          logger.error(e);
        });
    }
  }
}
