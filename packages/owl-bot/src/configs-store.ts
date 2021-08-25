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

import {
  OwlBotLock,
  owlBotLockFrom,
  owlBotLockPath,
  OwlBotYaml,
  owlBotYamlFromText,
} from './config-files';
import {GithubRepo} from './github-repo';
import * as fs from 'fs';
import path from 'path';
import {load} from 'js-yaml';
import {glob} from 'glob';

export interface OwlBotYamlAndPath {
  // The path in the repository where the .OwlBot.yaml was found.
  path: string;
  // The contents of the .OwlBot.yaml.
  yaml: OwlBotYaml;
}

export interface Configs {
  lock?: OwlBotLock;
  // The body of .Owlbot.yaml.
  yamls?: OwlBotYamlAndPath[];
  // The commit hash from which the config files were retrieved.
  commitHash: string;
  // The branch name from which the config files were retrieved.
  branchName: string;
  // The installation id for our github app and this repo.
  installationId: number;
}

/**
 * A repo affected by a change and the path to .OwlBot.yaml
 */
export interface AffectedRepo {
  repo: GithubRepo;
  // path to .OwlBot.yaml
  yamlPath: string;
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
   * Finds a previously recorded cloud build id or returns undefined.
   * @param repo full repo name like "googleapis/nodejs-vision"
   * @param lock The new contents of the lock file.
   * @returns the string passed to recordPullRequestForUpdatingLock().
   */
  findBuildIdForUpdatingLock(
    repo: string,
    lock: OwlBotLock
  ): Promise<string | undefined>;

  /**
   * Records a cloud build id created to update the lock file.
   * @param repo full repo name like "googleapis/nodejs-vision"
   * @param lock The new contents of the lock file.
   * @param buildIdId the string that will be later returned by
   *  findBuildIdForUpdatingLock().
   * @returns buildId, which may differ from the argument if there
   *   already was a pull request recorded.
   */
  recordBuildIdForUpdatingLock(
    repo: string,
    lock: OwlBotLock,
    buildId: string
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
  ): Promise<AffectedRepo[]>;
}

export interface CollectedConfigs {
  lock?: OwlBotLock;
  yamls: OwlBotYamlAndPath[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  badConfigs: {path: string; error: any}[];
}

/**
 * Examines the contents of a local repo directory and collects owl bot config
 * files.
 */
export function collectConfigs(dir: string): CollectedConfigs {
  const configs: CollectedConfigs = {
    yamls: [],
    badConfigs: [],
  };
  // .OwlBot.lock.yaml is always in a known location.
  const lockPath = path.join(dir, owlBotLockPath);
  if (fs.existsSync(lockPath)) {
    try {
      const lockText = fs.readFileSync(lockPath, 'utf8');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lockYaml = load(lockText) as Record<string, any>;
      configs.lock = owlBotLockFrom(lockYaml);
    } catch (e) {
      configs.badConfigs.push({path: owlBotLockPath, error: e});
    }
  }
  // .OwlBot.yamls may be scattered throughout the directory.  Find them.
  const yamlPaths = glob.sync(path.join('**', '.OwlBot.yaml'), {cwd: dir});
  // Glob ignores .dot files, and we need to look in the .github directory.
  yamlPaths.push(
    ...glob.sync(path.join('.github', '**', '.OwlBot.yaml'), {cwd: dir})
  );
  for (const yamlPath of yamlPaths) {
    try {
      const yamlText = fs.readFileSync(path.join(dir, yamlPath), 'utf8');
      configs.yamls.push({
        path: yamlPath,
        yaml: owlBotYamlFromText(yamlText),
      });
    } catch (e) {
      configs.badConfigs.push({path: yamlPath, error: e});
    }
  }
  return configs;
}
