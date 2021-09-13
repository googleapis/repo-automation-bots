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

import extend from 'extend';
import {
  LanguageConfig,
  RepoConfig,
  BranchProtectionRule,
  PermissionRule,
} from './types';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
// eslint-disable-next-line node/no-extraneous-import
import {RequestError} from '@octokit/types';
import checks from './required-checks.json';

export interface Logger {
  info(message: string): void;
  debug(message: string | {}): void;
  warn(message: string | {}): void;
  error(message: string | {}): void;
}

export const configFileName = 'sync-repo-settings.yaml';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepFreeze(object: any) {
  const propNames = Object.getOwnPropertyNames(object);
  for (const name of propNames) {
    const value = object[name];
    if (value && typeof value === 'object') {
      deepFreeze(value);
    }
  }
  return Object.freeze(object);
}
const languageConfig: LanguageConfig = deepFreeze(checks);

const repoConfigDefaults: RepoConfig = deepFreeze({
  mergeCommitAllowed: false,
  squashMergeAllowed: true,
  rebaseMergeAllowed: true,
  deleteBranchOnMerge: true,
});

const branchProtectionDefaults = deepFreeze({
  dismissesStaleReviews: false,
  isAdminEnforced: true,
  requiredApprovingReviewCount: 1,
  requiresCodeOwnerReviews: false,
  requiresCommitSignatures: false,
  requiresStatusChecks: true,
  requiresStrictStatusChecks: false,
  restrictsPushes: false,
  restrictsReviewDismissals: false,
  requiresLinearHistory: true,
  requiredStatusCheckContexts: [],
});

export interface SyncRepoSettingsOptions {
  config?: RepoConfig;
  repo: string;
  defaultBranch?: string;
}

export class SyncRepoSettings {
  constructor(private octokit: Octokit, private logger: Logger) {}

  async syncRepoSettings(options: SyncRepoSettingsOptions) {
    let config = options.config;
    const logger = this.logger;
    const repo = options.repo;
    const [owner, name] = repo.split('/');
    if (!config) {
      logger.info(`no local config found for ${repo}, checking global config`);
      // Fetch the list of languages used in this repository
      const langRes = await this.octokit.repos.listLanguages({
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

      config = extend(true, {}, languageConfig)[language];
      if (!config) {
        logger.info(`no config for language ${language}`);
      }
    }

    const defaultBranch =
      options.defaultBranch || (await this.getDefaultBranch(repo));
    const defaultBranchRuleConfig = {
      pattern: defaultBranch,
    };

    const jobs: Promise<void>[] = [];
    logger.info('updating settings');
    jobs.push(this.updateRepoTeams(repo, config?.permissionRules || []));
    if (config) {
      jobs.push(this.updateRepoOptions(repo, config));
      if (config.branchProtectionRules) {
        config.branchProtectionRules.forEach(rule => {
          const ruleWithDefaultBranch = {
            ...defaultBranchRuleConfig,
            ...rule,
          };
          jobs.push(this.updateBranchProtection(repo, ruleWithDefaultBranch));
        });
      }
    }
    await Promise.all(jobs);
  }

  /**
   * Enable branch protection, and required status checks
   * @param repo Owner/Repo to update
   * @param rule The branch protection rules
   */
  async updateBranchProtection(repo: string, rule: BranchProtectionRule) {
    const logger = this.logger;
    logger.info(`Updating ${rule.pattern} branch protection for ${repo}`);
    const [owner, name] = repo.split('/');

    logger.debug('Rules before applying defaults:');
    logger.debug(rule);

    // Combine user settings with a lax set of defaults
    rule = extend(true, {}, branchProtectionDefaults, rule);

    logger.debug('Rules after applying defaults:');
    logger.debug(rule);

    logger.debug(`Required status checks ${rule.requiredStatusCheckContexts}`);

    try {
      await this.octokit.repos.updateBranchProtection({
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
        required_linear_history: rule.requiresLinearHistory,
        restrictions: null!,
        headers: {
          accept: 'application/vnd.github.luke-cage-preview+json',
        },
      });
      logger.info(
        `Success updating branch protection for ${repo}:${rule.pattern}`
      );
    } catch (e) {
      const err = e as RequestError & Error;
      if (err.status === 401) {
        logger.warn(
          `updateBranchProtection: warning received ${err.status} updating ${owner}/${name}`
        );
      } else {
        err.message = `updateBranchProtection: error received ${err.status} updating ${owner}/${name}\n\n${err.message}`;
        logger.error(err);
        return;
      }
    }
  }

  /**
   * Ensure the correct teams are added to the repository
   * @param repos List of repos to iterate.
   */
  async updateRepoTeams(repo: string, rules: PermissionRule[]) {
    const logger = this.logger;
    logger.info(`Update team access for ${repo}`);
    const [owner, name] = repo.split('/');

    // Cloud DPEs and Cloud DevRel PgMs are given default write access to all repositories we manage.
    rules.push(
      {
        permission: 'push',
        team: 'cloud-dpe',
      },
      {
        permission: 'push',
        team: 'cloud-devrel-pgm',
      }
    );

    try {
      await Promise.all(
        rules.map(membership => {
          return this.octokit.teams.addOrUpdateRepoPermissionsInOrg({
            team_slug: membership.team,
            owner,
            org: owner,
            permission: membership.permission as 'push',
            repo: name,
          });
        })
      );
      logger.info(`Success updating repo in org for ${repo}`);
    } catch (e) {
      const err = e as RequestError & Error;
      const knownErrors = [
        401, // bot does not have permission to access this repository.
        404, // team being added does not exist on repo.
      ];
      if (knownErrors.includes(err.status)) {
        logger.warn(
          `updateRepoTeams: warning received ${err.status} updating ${owner}/${name}`
        );
      } else {
        err.message = `updateRepoTeams: error received ${err.status} updating ${owner}/${name}\n\n${err.message}`;
        logger.error(err);
        return;
      }
    }
  }

  /**
   * Update the main repository options
   * @param repos List of repos to iterate.
   */
  async updateRepoOptions(repo: string, config: RepoConfig) {
    const logger = this.logger;
    logger.info(`Updating commit settings for ${repo}`);
    const [owner, name] = repo.split('/');
    config = extend(true, {}, repoConfigDefaults, config);
    logger.info(`name: ${name}`);
    logger.info(`owner: ${owner}`);
    logger.info(`enable rebase? ${config.rebaseMergeAllowed}`);
    logger.info(`enable squash? ${config.squashMergeAllowed}`);

    try {
      await this.octokit.repos.update({
        name,
        repo: name,
        owner,
        allow_merge_commit: config.mergeCommitAllowed,
        allow_rebase_merge: config.rebaseMergeAllowed,
        allow_squash_merge: config.squashMergeAllowed,
        delete_branch_on_merge: config.deleteBranchOnMerge,
      });
      logger.info(`Success updating repo options for ${repo}`);
    } catch (e) {
      const err = e as RequestError & Error;
      const knownErrors = [
        401, // bot does not have permission to access this repository.
        403, // thrown if repo is archived.
      ];
      if (knownErrors.includes(err.status)) {
        logger.warn(
          `updateRepoOptions: warning received ${err.status} updating ${owner}/${name}`
        );
      } else {
        err.message = `updateRepoOptions: error received ${err.status} updating ${owner}/${name}\n\n${err.message}`;
        logger.error(err);
        return;
      }
    }
  }

  async getDefaultBranch(ownerAndRepo: string): Promise<string> {
    const [owner, repo] = ownerAndRepo.split('/');
    const response = await this.octokit.repos.get({
      owner,
      repo,
    });
    return response.data.default_branch;
  }
}
