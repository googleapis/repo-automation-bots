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
import {
  LanguageConfig,
  RepoConfig,
  BranchProtectionRule,
  PermissionRule,
} from './types';
import {logger} from 'gcf-utils';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const languageConfig: LanguageConfig = require('./required-checks.json');

const repoConfigDefaults: RepoConfig = {
  mergeCommitAllowed: false,
  squashMergeAllowed: true,
  rebaseMergeAllowed: true,
};

const branchProtectionDefaults: BranchProtectionRule = {
  pattern: 'master',
  dismissesStaleReviews: false,
  isAdminEnforced: true,
  requiredApprovingReviewCount: 1,
  requiresCodeOwnerReviews: false,
  requiresCommitSignatures: false,
  requiresStatusChecks: true,
  requiresStrictStatusChecks: false,
  restrictsPushes: false,
  restrictsReviewDismissals: false,
  requiredStatusCheckContexts: [],
};

/**
 * Main.  On a nightly cron, update the settings for a given repository.
 */
export function handler(app: Application) {
  app.on(['schedule.repository'], async (context: Context) => {
    logger.info(`running for org ${context.payload.cron_org}`);
    const owner = context.payload.organization.login;
    const name = context.payload.repository.name;
    const repo = `${owner}/${name}`;

    if (context.payload.cron_org !== owner) {
      logger.info(`skipping run for ${context.payload.cron_org}`);
      return;
    }

    let ignored = false;

    /**
     * Allow repositories to optionally provide their own, localized config.
     * Check the `.github/sync-repo-settings.yaml` file, and if available,
     * use that config over any config broadly provided here.
     */
    let config!: RepoConfig | null;
    try {
      config = await context.config<RepoConfig>('sync-repo-settings.yaml');
    } catch (err) {
      err.message = `Error reading configuration: ${err.message}`;
      logger.error(err);
    }

    if (!config) {
      logger.info(`no local config found for ${repo}, checking global config`);
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

      config = languageConfig[language];
      if (!config) {
        logger.info(`no config for language ${language}`);
        return;
      }

      // Check for repositories we're specifically configured to skip
      ignored = !!languageConfig[language]?.ignoredRepos?.find(x => x === repo);
      if (ignored) {
        logger.info(`ignoring repo ${repo}`);
      }

      if (languageConfig[language]?.repoOverrides) {
        const customConfig = languageConfig[language].repoOverrides?.find(
          x => x.repo === repo
        );
        if (customConfig) {
          logger.info(`Discovered override config for ${repo}`);
          config.branchProtectionRules = customConfig.branchProtectionRules;
        }
      }
    }

    const jobs: Promise<void>[] = [];
    if (config!.permissionRules) {
      jobs.push(updateRepoTeams(repo, context, config.permissionRules));
    }
    if (!ignored) {
      jobs.push(updateRepoOptions(repo, context, config));
      if (config.branchProtectionRules) {
        jobs.push(
          updateMasterBranchProtection(
            repo,
            context,
            config.branchProtectionRules
          )
        );
      }
    }
    await Promise.all(jobs);
  });
}

/**
 * Enable master branch protection, and required status checks
 * @param repos List of repos to iterate.
 */
async function updateMasterBranchProtection(
  repo: string,
  context: Context,
  rules: BranchProtectionRule[]
) {
  logger.info(`Updating master branch protection for ${repo}`);
  const [owner, name] = repo.split('/');

  // TODO: add support for mutiple rules
  let rule = rules[0];

  // Combine user settings with a lax set of defaults
  rule = Object.assign({}, branchProtectionDefaults, rule);

  logger.debug(`Required status checks ${rule.requiredStatusCheckContexts}`);

  try {
    await context.github.repos.updateBranchProtection({
      branch: rule.pattern,
      owner,
      repo: name,
      required_pull_request_reviews: {
        required_approving_review_count: rule.requiredApprovingReviewCount,
        dismiss_stale_reviews: rule.dismissesStaleReviews,
        require_code_owner_reviews: rule.requiresCodeOwnerReviews,
      },
      required_status_checks: {
        contexts: rule.requiredStatusCheckContexts!,
        strict: rule.requiresStrictStatusChecks!,
      },
      enforce_admins: rule.isAdminEnforced!,
      restrictions: null!,
      headers: {
        accept: 'application/vnd.github.luke-cage-preview+json',
      },
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
  logger.info(`Success updating master branch protection for ${repo}`);
}

/**
 * Ensure the correct teams are added to the repository
 * @param repos List of repos to iterate.
 */
async function updateRepoTeams(
  repo: string,
  context: Context,
  rules: PermissionRule[]
) {
  logger.info(`Update team access for ${repo}`);
  const [owner, name] = repo.split('/');

  try {
    await Promise.all(
      rules.map(membership => {
        return context.github.teams.addOrUpdateRepoInOrg({
          team_slug: membership.team,
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
  logger.info(`Success updating repo in org for ${repo}`);
}

/**
 * Update the main repository options
 * @param repos List of repos to iterate.
 */
async function updateRepoOptions(
  repo: string,
  context: Context,
  config: RepoConfig
) {
  logger.info(`Updating commit settings for ${repo}`);
  const [owner, name] = repo.split('/');
  config = Object.assign({}, repoConfigDefaults, config);
  logger.info(`name: ${name}`);
  logger.info(`owner: ${owner}`);
  logger.info(`enable rebase? ${config.rebaseMergeAllowed}`);
  logger.info(`enable squash? ${config.squashMergeAllowed}`);

  try {
    await context.github.repos.update({
      name,
      repo: name,
      owner,
      allow_merge_commit: config.mergeCommitAllowed,
      allow_rebase_merge: config.rebaseMergeAllowed,
      allow_squash_merge: config.squashMergeAllowed,
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
  logger.info(`Success updating repo options for ${repo}`);
}
