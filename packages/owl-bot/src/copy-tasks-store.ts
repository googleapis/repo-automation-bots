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

// Stores information about copy tasks that we have posted to Pubsub,
// so that we don't kick off duplicate tasks.  A 'copy task' copies
// generated source files from googleapis/googleapis-gen to target
// repos like googleapis/nodejs-vision.
export interface CopyTasksStore {
  /**
   * Finds a previously recorded message id or returns undefined.
   * @param repo full repo name like "googleapis/nodejs-vision"
   * @param googleapisGenCommitHash the commit hash for the commit to
   *   googleapis-gen in which the files were changed
   * @returns the string passed to recordPubsubMessageIdForCopyTask().
   */
  findPubsubMessageIdForCopyTask(
    repo: string,
    googleapisGenCommitHash: string
  ): Promise<string | undefined>;

  /**
   * Records a pubsub message id that was published to kick off a copy task.
   * @param repo full repo name like "googleapis/nodejs-vision"
   * @param googleapisGenCommitHash the commit hash for the commit to
   *   googleapis-gen in which the files were changed
   * @param pullRequestId the string that will be later returned by
   *  findPullRequestForUpdatingLock().
   * @returns pullRequestId, which may differ from the argument if there
   *   already was a pull request recorded.
   *   In that case, the caller should close the pull request they
   *   created, to avoid annoying maintainers with duplicate pull requests.
   */
  recordPubsubMessageIdForCopyTask(
    repo: string,
    googleapisGenCommitHash: string,
    pubsubMessageId: string
  ): Promise<string>;

  /**
   * Finds repos for which a copy task has not been initiated yet.
   * @param repos a list of full repo names like ["googleapis/nodejs-vision"]
   * @param googleapisGenCommitHash the commit hash for the commit to
   *   googleapis-gen in which the files were changed
   * @returns a subset of the repos param, the list of repos for which a
   *   pubsub message id has not yet been recorded
   */
  filterMissingCopyTasks(
    repos: string[],
    googleapisGenCommitHash: string
  ): Promise<string[]>;
}
