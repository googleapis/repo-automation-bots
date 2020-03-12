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

import { Application, Context } from 'probot';
import { request } from 'gaxios';

const languageConfig: LanguageConfig = require('../../required-checks.json');

interface LanguageConfig {
  [index: string]: {
    enableSquashMerge: boolean;
    enableRebaseMerge: boolean;
    requireUpToDateBranch: boolean;
    requiredStatusChecks: string[];
    ignoredRepos?: string[];
    repoOverrides?: [
      {
        repo: string;
        requiredStatusChecks: string[];
      }
    ];
  };
}

interface Repo {
  language: string;
  repo: string;
}

interface GetReposResponse {
  repos: Repo[];
}

/**
 * Acquire a list of repositories from sloth.
 * Cache the result.
 */
let _repos: GetReposResponse;
handler.getRepos = async function getRepos(): Promise<GetReposResponse> {
  if (!_repos) {
    const res = await request<GetReposResponse>({
      url:
        'https://raw.githubusercontent.com/googleapis/sloth/master/repos.json',
    });
    _repos = res.data;
  }
  return _repos;
};

/**
 * Main.  On a nightly cron, update the settings for a given repository.
 */
function handler(app: Application) {
  app.on(['schedule.repository'], async (context: Context) => {
    const owner = context.payload.organization.login;
    const name = context.payload.repository.name;
    const repo = `${owner}/${name}`;

    // find the repo record in repos.json
    const repos = await handler.getRepos();
    const r = repos.repos.find(x => x.repo === repo);
    if (!r) {
      return;
    }

    // update each settings section
    await handler.updateRepoOptions(r, context);
    await handler.updateMasterBranchProtection(r, context);
    await handler.updateRepoTeams(r, context);
  });
}

/**
 * Enable master branch protection, and required status checks
 * @param repos List of repos to iterate.
 */
handler.updateMasterBranchProtection = async function updateMasterBranchProtection(
  repo: Repo,
  context: Context
) {
  console.log(`Updating master branch protection for ${repo.repo}`);
  const [owner, name] = repo.repo.split('/');

  // get the status checks defined at either the language level, or at the
  // overridden repository level
  const config = languageConfig[repo.language];
  if (!config) {
    return;
  }

  let checks = config.requiredStatusChecks;
  if (config.repoOverrides) {
    const customConfig = config.repoOverrides.find(x => x.repo === repo.repo);
    if (customConfig) {
      checks = customConfig.requiredStatusChecks;
    }
  }

  await context.github.repos.updateBranchProtection({
    branch: 'master',
    owner,
    repo: name,
    required_pull_request_reviews: {
      dismiss_stale_reviews: false,
      require_code_owner_reviews: false,
    },
    required_status_checks: {
      contexts: checks,
      strict: config.requireUpToDateBranch,
    },
    enforce_admins: true,
    restrictions: null!,
  });
};

/**
 * Ensure the correct teams are added to the repository
 * @param repos List of repos to iterate.
 */
handler.updateRepoTeams = async function updateRepoTeams(
  repo: Repo,
  context: Context
) {
  console.log(`Update team access for ${repo.repo}`);
  const [owner, name] = repo.repo.split('/');
  const teamsToAdd = [
    {
      slug: 'yoshi-admins',
      permission: 'admin',
    },
    {
      slug: `yoshi-${repo.language}-admins`,
      permission: 'admin',
    },
    {
      slug: `yoshi-${repo.language}`,
      permission: 'push',
    },
  ];

  for (const membership of teamsToAdd) {
    await context.github.teams.addOrUpdateRepoInOrg({
      team_slug: membership.slug,
      owner,
      org: owner,
      permission: membership.permission as 'push',
      repo: name,
    });
  }
};

/**
 * Update the main repository options
 * @param repos List of repos to iterate.
 */
handler.updateRepoOptions = async function updateRepoOptions(
  repo: Repo,
  context: Context
) {
  console.log(`Updating commit settings for ${repo.repo}`);
  const [owner, name] = repo.repo.split('/');
  const config = languageConfig[repo.language];
  if (!config) {
    return;
  }

  await context.github.repos.update({
    name,
    repo: name,
    owner,
    allow_merge_commit: false,
    allow_rebase_merge: config.enableRebaseMerge,
    allow_squash_merge: config.enableSquashMerge,
  });
};

export = handler;
