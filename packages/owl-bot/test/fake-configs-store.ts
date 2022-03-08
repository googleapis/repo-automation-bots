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

import {AffectedRepo, Configs, ConfigsStore} from '../src/configs-store';
import {OwlBotLock, toFrontMatchRegExp} from '../src/config-files';
import {githubRepoFromOwnerSlashName} from '../src/github-repo';
// There are lots of unused args on fake functions, and that's ok.
/* eslint-disable @typescript-eslint/no-unused-vars */

export class FakeConfigsStore implements ConfigsStore {
  readonly configs: Map<string, Configs>;
  readonly githubRepos: Map<string, AffectedRepo>;

  constructor(configs?: Map<string, Configs>) {
    this.configs = configs ?? new Map<string, Configs>();
    this.githubRepos = new Map();
  }
  findBuildIdForUpdatingLock(
    repo: string,
    lock: OwlBotLock
  ): Promise<string | undefined> {
    throw new Error('Method not implemented.');
  }
  recordBuildIdForUpdatingLock(
    repo: string,
    lock: OwlBotLock,
    buildId: string
  ): Promise<string> {
    throw new Error('Method not implemented.');
  }
  findReposAffectedByFileChanges(
    changedFilePaths: string[]
  ): Promise<AffectedRepo[]> {
    const result: AffectedRepo[] = [];
    for (const [repoName, config] of this.configs) {
      repoLoop: for (const yaml of config.yamls ?? []) {
        for (const deepCopy of yaml.yaml['deep-copy-regex'] ?? []) {
          const regexp = toFrontMatchRegExp(deepCopy.source);
          for (const filePath of changedFilePaths) {
            if (regexp.test(filePath)) {
              const repo =
                this.githubRepos.get(repoName)?.repo ??
                githubRepoFromOwnerSlashName(repoName);
              result.push({repo, yamlPath: yaml.path});
              break repoLoop;
            }
          }
        }
      }
    }
    return Promise.resolve(result);
  }

  getConfigs(repo: string): Promise<Configs | undefined> {
    return Promise.resolve(this.configs.get(repo));
  }

  storeConfigs(
    repo: string,
    configs: Configs,
    replaceCommithash: string | null
  ): Promise<boolean> {
    const existingCommitHash = this.configs.get(repo)?.commitHash ?? null;
    if (existingCommitHash === replaceCommithash) {
      this.configs.set(repo, configs);
      return Promise.resolve(true);
    } else {
      return Promise.resolve(false);
    }
  }

  clearConfigs(repo: string): Promise<void> {
    this.configs.delete(repo);
    return Promise.resolve();
  }

  findReposWithPostProcessor(
    dockerImageName: string
  ): Promise<[string, Configs][]> {
    throw new Error('Method not implemented.');
  }
}
