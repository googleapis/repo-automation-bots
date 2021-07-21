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

export interface RepoConfig {
  /**
   * Whether or not squash-merging is enabled on this repository.
   */
  squashMergeAllowed?: boolean;
  /**
   * Whether or not rebase-merging is enabled on this repository.
   */
  rebaseMergeAllowed?: boolean;
  /**
   * Whether or not PRs are merged with a merge commit on this repository.
   */
  mergeCommitAllowed?: boolean;
  /**
   * Either true to allow automatically deleting head branches when pull requests are merged, or false to prevent automatic deletion.
   */
  deleteBranchOnMerge?: boolean;
  /**
   * Branch protection rules
   */
  branchProtectionRules?: BranchProtectionRule[];
  /**
   * List of explicit permissions to add (additive only)
   */
  permissionRules?: PermissionRule[];
}

export type Permission = 'pull' | 'push' | 'admin';

export interface PermissionRule {
  /**
   * team slug to provide access
   */
  team: string;
  /**
   * Permission to provide the team
   */
  permission: Permission;
}

export interface BranchProtectionRule {
  /**
   * Identifies the protection rule pattern.
   */
  pattern: string;
  /**
   * Will new commits pushed to matching branches dismiss pull request review approvals.
   */
  dismissesStaleReviews?: boolean;
  /**
   * Can admins overwrite branch protection.
   */
  isAdminEnforced?: boolean;
  /**
   * Number of approving reviews required to update matching branches.
   */
  requiredApprovingReviewCount?: number;
  /**
   * List of required status check contexts that must pass for commits to be accepted to matching branches.
   */
  requiredStatusCheckContexts?: string[];
  /**
   * Are reviews from code owners required to update matching branches.
   */
  requiresCodeOwnerReviews?: boolean;
  /**
   * Are commits required to be signed.
   */
  requiresCommitSignatures?: boolean;
  /**
   * Are status checks required to update matching branches.
   */
  requiresStatusChecks?: boolean;
  /**
   * Are branches required to be up to date before merging.
   */
  requiresStrictStatusChecks?: boolean;
  /**
   * Is pushing to matching branches restricted.
   */
  restrictsPushes?: boolean;
  /**
   * Is dismissal of pull request reviews restricted.
   */
  restrictsReviewDismissals?: boolean;

  /**
   * Enforces a linear commit Git history, which prevents anyone from pushing
   * merge commits to a branch. Set to true to enforce a linear commit history.
   * Set to false to disable a linear commit Git history. Your repository must
   * allow squash merging or rebase merging before you can enable a linear
   * commit history. Default: true. For more information, see "Requiring a
   * linear commit history" in the GitHub Help documentation.
   */
  requiresLinearHistory?: boolean;
}

/**
 * Legacy monoconfig types
 */

export interface LegacyOverrideConfig extends RepoConfig {
  repo: string;
}

export interface LegacyRepoConfig extends RepoConfig {
  ignoredRepos?: string[];
  repoOverrides?: LegacyOverrideConfig[];
}

export interface LanguageConfig {
  [index: string]: LegacyRepoConfig;
}

export interface Repo {
  language: string;
  repo: string;
}
