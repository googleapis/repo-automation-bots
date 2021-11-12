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

import yargs = require('yargs');
import {octokitFrom} from '../../octokit-util';
import {BigQuery} from '@google-cloud/bigquery';
import {Storage} from '@google-cloud/storage';

interface Args {
  'pem-path': string;
  'app-id': number;
  installation: number;
  org: string;
  project: string;
  'commit-cache-bucket': string;
  dataset: string;
  table: string;
}

export const populateMetrics: yargs.CommandModule<{}, Args> = {
  command: 'populate-metrics',
  describe:
    'populate bigquery database with interesting OwlBot metrics from GitHub',
  builder(yargs) {
    return yargs
      .option('pem-path', {
        describe: 'provide path to private key for requesting JWT',
        type: 'string',
        demand: true,
      })
      .option('app-id', {
        describe: 'GitHub AppID',
        type: 'number',
        demand: true,
      })
      .option('installation', {
        describe: 'installation ID for GitHub app',
        type: 'number',
        demand: true,
      })
      .option('org', {
        describe: 'organization to scan for configuration files',
        type: 'string',
        demand: true,
        default: 'googleapis',
      })
      .option('project', {
        describe: 'project to update OwlBot metrics in',
        type: 'string',
        demand: true,
        default: 'repo-automation-bots',
      })
      .option('commit-cache-bucket', {
        describe: 'bucket used to store GitHub commit cache',
        type: 'string',
        default: 'github_commit_cache',
      })
      .option('dataset', {
        describe: 'the bigquery dataset',
        type: 'string',
        default: 'automation_metrics',
      })
      .option('table', {
        describe: 'the bigquery table',
        type: 'string',
        default: 'owlbot_migration',
      });
  },
  async handler(argv) {
    const octokit = await octokitFrom(argv, true);
    const iterator = octokit.paginate.iterator(octokit.rest.repos.listForOrg, {
      org: argv.org,
    });
    const bigquery = new BigQuery();
    const storage = new Storage({
      projectId: argv.project,
    });
    for await (const {data: repos} of iterator) {
      for (const repo of repos) {
        if (repo.archived) continue; // Ignore archived repositories.
        try {
          const commits = (
            await octokit.rest.repos.listCommits({
              owner: argv.org,
              repo: repo.name,
              per_page: 3,
            })
          ).data;
          // Immediately after a commit, it can take a few minutes for a
          // manifest to populate, check the last few commits to
          // allow for this:
          let manifest = '';
          for (let i = 0; i < 4; i++) {
            const commit = commits[i];
            if (commit) {
              // https://storage.cloud.google.com/github_commit_cache/owners/googleapis/repos/common-protos-ruby/commits/05c465a67533c9b0f71b1ff49903743a657c4208/file_manifest.txt
              const manifestFile = `owners/${argv.org}/repos/${repo.name}/commits/${commit.sha}/file_manifest.txt`;
              try {
                const [result] = await storage
                  .bucket(argv['commit-cache-bucket'])
                  .file(manifestFile)
                  .download();
                manifest = result.toString('utf8');
              } catch (_err) {
                const err = _err as {code: number};
                if (err.code === 404) {
                  continue;
                } else {
                  throw err;
                }
              }
            }
          }
          // If we found a manifest, update metrics for OwlBot/synthtool:
          if (manifest !== '') {
            for (const line of manifest.trim().split(/[\r?\n]/)) {
              const record = {
                repo: repo.full_name,
                synth_count: 0,
                owlbot_lock_count: 0,
                path: line,
                language: repo.language ?? 'unknown',
                created: new Date().toISOString().slice(0, 10),
              };
              if (line.includes('.OwlBot.yaml')) {
                record.owlbot_lock_count++;
              }
              if (line.includes('synth.py')) {
                record.synth_count++;
              }
              if (record.synth_count || record.owlbot_lock_count) {
                const rows = [record];
                await bigquery
                  .dataset(argv.dataset)
                  .table(argv.table)
                  .insert(rows);
                console.info('inserted row', record);
              }
            }
          }
        } catch (_err) {
          const err = _err as {status: number};
          if (err.status === 409) {
            continue;
          } else {
            console.error(err);
          }
        }
      }
    }
  },
};
