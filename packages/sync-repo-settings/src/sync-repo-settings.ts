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

// eslint-disable-next-line @typescript-eslint/no-var-requires
const languageConfig: LanguageConfig = require('./required-checks.json');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const languageTeams: LanguageTeamConfig = require('./teams.json');

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

type Permission = 'pull' | 'push' | 'admin' | 'maintain' | 'triage';

interface TeamPermission {
  slug: string;
  permission: Permission;
}

interface LanguageTeamConfig {
  [index: string]: [TeamPermission];
}

interface Repo {
  language: string;
  repo: string;
}

/**
 * Main.  On a nightly cron, update the settings for a given repository.
 */
function handler(app: Application) {
  app.on(['schedule.repository'], async (context: Context) => {
    console.info(`running for org ${context.payload.cron_org}`);
    const owner = context.payload.organization.login;
    const name = context.payload.repository.name;
    const repo = `${owner}/${name}`;

    // Fetch the list of languages used in this repository
    const langRes = await context.github.repos.listLanguages({
      owner,
      repo: name,
    });

    // Given an object like this:
    // {
    //   python: 24
    //   javascript: 22
    // }
    // Sort the keys based on instance count.
    const languages = Object.entries(langRes.data).sort((a, b) => {
      return a[1] > b[1] ? -1 : a[1] < b[1] ? 1 : 0;
    });

    // If GitHub says this doesn't have a language ...
    if (languages.length === 0) {
      return;
    }

    // Use the language with the highest line count
    let language = languages[0][0].toLowerCase();

    // Add a little hackery for node
    if (language === 'javascript' || language === 'typescript') {
      language = 'nodejs';
    }
    console.log(`Determined ${repo} is ${language}`);

    // Check for repositories we're specifically configured to skip
    if (languageConfig[language]) {
      const ignored = languageConfig[language].ignoredRepos?.find(
        x => x === repo
      );
      if (ignored) {
        console.log(`ignoring repo ${repo}`);
        return;
      }
    }

    if (context.payload.cron_org !== owner) {
      console.log(`skipping run for ${context.payload.cron_org}`);
      return;
    }

    const yoshiRepo = {repo, language};
    const start = new Date().getTime();
    // update each settings section
    await Promise.all([
      handler.updateRepoOptions(yoshiRepo, context),
      handler.updateMasterBranchProtection(yoshiRepo, context),
      handler.updateRepoTeams(yoshiRepo, context),
    ]);

    const end = new Date().getTime();
    console.log(`Execution finished in ${end - start} ms.`);
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
  try {
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
    console.log(`Success updating master branch protection for ${repo.repo}`);
  } catch (err) {
    console.log(
      `Error updating master protection for ${repo.repo} error status: ${err.status}`
    );
  }
};

handler.defaultLanguageTeams = function (language: string): TeamPermission[] {
  return [
    {
      slug: 'yoshi-admins',
      permission: 'admin',
    },
    {
      slug: `yoshi-${language}-admins`,
      permission: 'admin',
    },
    {
      slug: `yoshi-${language}`,
      permission: 'push',
    },
  ];
};

handler.getRepoTeams = function (repo: Repo): TeamPermission[] {
  const language = repo.language;
  const teams = handler.defaultLanguageTeams(language);
  if (language in languageTeams) {
    teams.push(...languageTeams[language]);
  }
  return teams;
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
  const teamsToAdd = handler.getRepoTeams(repo);

  for (const membership of teamsToAdd) {
    try {
      await context.github.teams.addOrUpdateRepoInOrg({
        team_slug: membership.slug,
        owner,
        org: owner,
        permission: membership.permission as 'push',
        repo: name,
      });
      console.log(`Success updating repo in org for ${repo.repo}`);
    } catch (err) {
      console.log(
        `Error updating repo in org for ${repo.repo} error status: ${err.status}`
      );
    }
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
  console.log(`name: ${name}`);
  console.log(`owner: ${owner}`);
  console.log(`enable rebase? ${config.enableRebaseMerge}`);
  console.log(`enable sqaush? ${config.enableSquashMerge}`);

  try {
    await context.github.repos.update({
      name,
      repo: name,
      owner,
      allow_merge_commit: false,
      allow_rebase_merge: config.enableRebaseMerge,
      allow_squash_merge: config.enableSquashMerge,
    });
    console.log(`Success updating repo options for ${repo.repo}`);
  } catch (err) {
    console.log(err);
    console.log(
      `Error updating repo options for  ${repo.repo} error status: ${err.status}`
    );
  }
};

export = handler;
