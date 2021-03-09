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

import {OwlBotLock, OwlBotYaml} from './config-files';
import {GithubRepo} from './github-repo';

export interface Configs {
  // The body of .Owlbot.lock.yaml.
  lock?: OwlBotLock;
  // The body of .Owlbot.yaml.
  yaml?: OwlBotYaml;
  // The commit hash from which the config files were retrieved.
  commitHash: string;
  // The branch name from which the config files were retrieved.
  branchName: string;
  // The installation id for our github app and this repo.
  installationId: number;
}

export interface ConfigsStore {
  /**
   * Gets the configuration files contents for the given repo.
   * @param repo full repo name like "googleapis/nodejs-vision"
   */
  getConfigs(repo: string): Promise<Configs | undefined>;

  /**
   * Stores configuration files contents into the database.
   * @param repo full repo name like "googleapis/nodejs-vision"
   * @param configs the contents of the configuration files.
   * @param replaceCommithash the commithash as returned by an earlier
   *   call to getConfigs.  Enables atomic updates.
   * @returns true if replaceCommithash matched the commithash in the database
   *   and the configs were stored; otherwise false and the configs were
   *   not stored.
   */
  storeConfigs(
    repo: string,
    configs: Configs,
    replaceCommithash: string | null
  ): Promise<boolean>;

  /**
   * Finds repos with their docker.image set to dockerImaegname in their
   * .OwlBot.lock.yaml files.
   * @param dockerImageName the name of the post-processore docker image
   * @returns a list of [repo-name, config].
   */
  findReposWithPostProcessor(
    dockerImageName: string
  ): Promise<[string, Configs][]>;

  /**
   * Finds a previously recorded pull request or returns undefined.
   * @param repo full repo name like "googleapis/nodejs-vision"
   * @param lock The new contents of the lock file.
   * @returns the string passed to recordPullRequestForUpdatingLock().
   */
  findPullRequestForUpdatingLock(
    repo: string,
    lock: OwlBotLock
  ): Promise<string | undefined>;

  /**
   * Records a pull request created to update the lock file.
   * @param repo full repo name like "googleapis/nodejs-vision"
   * @param lock The new contents of the lock file.
   * @param pullRequestId the string that will be later returned by
   *  findPullRequestForUpdatingLock().
   * @returns pullRequestId, which may differ from the argument if there
   *   already was a pull request recorded.
   *   In that case, the caller should close the pull request they
   *   created, to avoid annoying maintainers with duplicate pull requests.
   */
  recordPullRequestForUpdatingLock(
    repo: string,
    lock: OwlBotLock,
    pullRequestId: string
  ): Promise<string>;

  /**
   * Finds repositories who list one of the changed files as a source in
   * copy-files.
   * @param changedFilePaths file paths in googleapis that changed.
   *   ex: ["/google/cloud/vision/v1/vision-v1-nodejs/src/v1/image_annotator_client.ts"]
   * @returns the list of repo names.
   *   ex: ["googleapis/nodejs-vision", "googleapis/python-vision"]
   */
  findReposAffectedByFileChanges(
    changedFilePaths: string[]
  ): Promise<GithubRepo[]>;
}
