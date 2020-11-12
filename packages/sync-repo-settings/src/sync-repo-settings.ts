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
import extend from 'extend';
import {
  LanguageConfig,
  RepoConfig,
  BranchProtectionRule,
  PermissionRule,
} from './types';
import {logger} from 'gcf-utils';
import Ajv from 'ajv';
import yaml from 'js-yaml';
import {PullsListFilesResponseData} from '@octokit/types';

export const configFileName = 'sync-repo-settings.yml';

type Conclusion =
  | 'success'
  | 'failure'
  | 'neutral'
  | 'cancelled'
  | 'timed_out'
  | 'action_required'
  | undefined;

// configure the schema validator once
// eslint-disable-next-line @typescript-eslint/no-var-requires
const schema = require('./schema.json');
const ajv = new Ajv();

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

const languageConfig: LanguageConfig = deepFreeze(
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('./required-checks.json')
);

const repoConfigDefaults: RepoConfig = deepFreeze({
  mergeCommitAllowed: false,
  squashMergeAllowed: true,
  rebaseMergeAllowed: true,
});

const branchProtectionDefaults = deepFreeze({
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
});

/**
 * Main.  On a nightly cron, update the settings for a given repository.
 */
export function handler(app: Application) {
  // Lint any pull requests that touch configuration
  app.on(
    [
      'pull_request.opened',
      'pull_request.reopened',
      'pull_request.synchronize',
    ],
    async (context: Context) => {
      const owner = context.payload.repository.owner.login;
      const repo = context.payload.repository.name;
      const number = context.payload.number;
      let files: PullsListFilesResponseData;
      try {
        files = await context.github.paginate(
          context.github.pulls.listFiles.endpoint.merge({
            owner,
            repo,
            pull_number: number,
            per_page: 100,
          })
        );
      } catch (e) {
        e.message = `Error fetching files for PR ${owner}/${repo}#${number}\n\n${e.message}`;
        logger.error(e);
        return;
      }
      for (const file of files) {
        if (
          file.status === 'deleted' ||
          (file.filename !== `.github/${configFileName}` &&
            (repo !== '.github' || file.filename !== configFileName))
        ) {
          continue;
        }
        const blob = await context.github.git.getBlob({
          owner,
          repo,
          file_sha: file.sha,
        });
        const configYaml = Buffer.from(blob.data.content, 'base64').toString(
          'utf8'
        );
        const config = yaml.safeLoad(configYaml);
        let isValid = false;
        let errorText = '';
        if (typeof config === 'object') {
          const validateSchema = ajv.compile(schema);
          isValid = await validateSchema(config);
          errorText = JSON.stringify(validateSchema.errors, null, 4);
        } else {
          errorText = `${configFileName} is not valid YAML 😱`;
        }

        const checkParams = context.repo({
          name: 'sync-repo-settings-check',
          head_sha: context.payload.pull_request.head.sha,
          conclusion: 'success' as Conclusion,
          output: {
            title: 'Successful sync-repo-settings.yaml check',
            summary: 'sync-repo-settings.yaml matches the required schema',
            text: 'Success',
          },
        });
        if (!isValid) {
          (checkParams.conclusion = 'failure'),
            (checkParams.output = {
              title: 'Invalid sync-repo-settings.yaml schema 😱',
              summary:
                'sync-repo-settings.yaml does not match the required schema 😱',
              text: errorText,
            });
        }
        try {
          await context.github.checks.create(checkParams);
        } catch (e) {
          e.message = `Error creating validation status check: ${e.message}`;
          logger.error(e);
        }
      }
    }
  );

  // meta comment about the '*' here: https://github.com/octokit/webhooks.js/issues/277

  app.on(['schedule.repository' as '*'], async (context: Context) => {
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

      config = extend(true, {}, languageConfig)[language];
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
        const customConfig = languageConfig[language].repoOverrides!.find(
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
        //console.log(JSON.stringify(config.branchProtectionRules))
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
  logger.debug('Rules before applying defaults:');
  logger.debug(rule);

  // Combine user settings with a lax set of defaults
  rule = extend(true, {}, branchProtectionDefaults, rule);

  logger.debug('Rules after applying defaults:');
  logger.debug(rule);

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
    logger.info(`Success updating master branch protection for ${repo}`);
  } catch (err) {
    if (err.status === 401) {
      logger.warn(
        `updateMasterBranchProtection: warning received ${err.status} updating ${owner}/${name}`
      );
    } else {
      err.message = `updateMasterBranchProtection: error received ${err.status} updating ${owner}/${name}\n\n${err.message}`;
      logger.error(err);
      return;
    }
  }
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

  // Cloud DPEs are given default write access to all repositories we manage.
  rules.push({
    permission: 'push',
    team: 'cloud-dpes',
  });

  try {
    await Promise.all(
      rules.map(membership => {
        return context.github.teams.addOrUpdateRepoPermissionsInOrg({
          team_slug: membership.team,
          owner,
          org: owner,
          permission: membership.permission as 'push',
          repo: name,
        });
      })
    );
    logger.info(`Success updating repo in org for ${repo}`);
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
async function updateRepoOptions(
  repo: string,
  context: Context,
  config: RepoConfig
) {
  logger.info(`Updating commit settings for ${repo}`);
  const [owner, name] = repo.split('/');
  config = extend(true, {}, repoConfigDefaults, config);
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
    logger.info(`Success updating repo options for ${repo}`);
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
      err.message = `updateRepoOptions: error received ${err.status} updating ${owner}/${name}\n\n${err.message}`;
      logger.error(err);
      return;
    }
  }
}
