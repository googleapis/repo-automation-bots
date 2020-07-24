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
import {logger} from 'gcf-utils';

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
export function handler(app: Application) {
  app.on(['schedule.repository'], async (context: Context) => {
    logger.info(`running for org ${context.payload.cron_org}`);
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
    logger.info(`Determined ${repo} is ${language}`);

    // Check for repositories we're specifically configured to skip
    const ignored = languageConfig[language]?.ignoredRepos?.find(
      x => x === repo
    );
    if (ignored) {
      logger.info(`ignoring repo ${repo}`);
    }

    if (context.payload.cron_org !== owner) {
      logger.info(`skipping run for ${context.payload.cron_org}`);
      return;
    }

    const yoshiRepo = {repo, language};
    const start = new Date().getTime();
    // For all repositories, we are going to try to add the appropriate language
    // focused team, even if it is flagged as "ignored". Generally folks use this
    // flag to prevent status checks or repo settings from propagating, and team
    // management isn't an actual issue.
    const jobs = [updateRepoTeams(yoshiRepo, context)];
    if (!ignored) {
      jobs.push(
        updateRepoOptions(yoshiRepo, context),
        updateMasterBranchProtection(yoshiRepo, context)
      );
    }
    await Promise.all(jobs);
    const end = new Date().getTime();
    logger.info(`Execution finished in ${end - start} ms.`);
  });
}

/**
 * Enable master branch protection, and required status checks
 * @param repos List of repos to iterate.
 */
async function updateMasterBranchProtection(repo: Repo, context: Context) {
  logger.info(`Updating master branch protection for ${repo.repo}`);
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
  } catch (err) {
    if (err.status === 401) {
      logger.warn(
        `updateMasterBranchProtection: warning received ${err.status} updating ${owner}/${name}`
      );
    } else {
      logger.error(
        `updateMasterBranchProtection: error received ${err.status} updating ${owner}/${name}`
      );
      throw err;
    }
  }
  logger.info(`Success updating master branch protection for ${repo.repo}`);
}

function getRepoTeams(language: string): TeamPermission[] {
  const teams = [
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
  ] as TeamPermission[];
  if (language in languageTeams) {
    teams.push(...languageTeams[language]);
  }
  return teams;
}

/**
 * Ensure the correct teams are added to the repository
 * @param repos List of repos to iterate.
 */
async function updateRepoTeams(repo: Repo, context: Context) {
  logger.info(`Update team access for ${repo.repo}`);
  const [owner, name] = repo.repo.split('/');
  const teamsToAdd = getRepoTeams(repo.language);
  try {
    await Promise.all(
      teamsToAdd.map(membership => {
        return context.github.teams.addOrUpdateRepoInOrg({
          team_slug: membership.slug,
          owner,
          org: owner,
          permission: membership.permission as 'push',
          repo: name,
        });
      })
    );
  } catch (err) {
    const knownErrors = [
      401, // bot does not have permission to access this repository.
      404, // team being added does not exist on repo.
    ];
    if (knownErrors.includes(err.status)) {
      logger.warn(
        `updateRepoTeams: warning received ${err.status} updating ${owner}/${name}`
      );
    } else {
      logger.error(
        `updateRepoTeams: error received ${err.status} updating ${owner}/${name}`
      );
      throw err;
    }
  }
  logger.info(`Success updating repo in org for ${repo.repo}`);
}

/**
 * Update the main repository options
 * @param repos List of repos to iterate.
 */
async function updateRepoOptions(repo: Repo, context: Context) {
  logger.info(`Updating commit settings for ${repo.repo}`);
  const [owner, name] = repo.repo.split('/');
  const config = languageConfig[repo.language];
  if (!config) {
    return;
  }
  logger.info(`name: ${name}`);
  logger.info(`owner: ${owner}`);
  logger.info(`enable rebase? ${config.enableRebaseMerge}`);
  logger.info(`enable squash? ${config.enableSquashMerge}`);

  try {
    await context.github.repos.update({
      name,
      repo: name,
      owner,
      allow_merge_commit: false,
      allow_rebase_merge: config.enableRebaseMerge,
      allow_squash_merge: config.enableSquashMerge,
    });
  } catch (err) {
    const knownErrors = [
      401, // bot does not have permission to access this repository.
      403, // thrown if repo is archived.
    ];
    if (knownErrors.includes(err.status)) {
      logger.warn(
        `updateRepoOptions: warning received ${err.status} updating ${owner}/${name}`
      );
    } else {
      logger.error(
        `updateRepoOptions: error received ${err.status} updating ${owner}/${name}`
      );
      throw err;
    }
  }
  logger.info(`Success updating repo options for ${repo.repo}`);
}
