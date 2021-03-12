// Copyright 2021 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {Octokit} from '@octokit/rest';
import {createPullRequest, Changes} from 'code-suggester';
import * as yaml from 'js-yaml';

interface RunnerOptions {
  branchName: string;
  targetTag: string;
  releaseType?: string;
  gitHubToken: string;
  upstreamRepo: string;
  upstreamOwner: string;
}

interface ReleasePleaseBranchConfig {
  branch: string;
  releaseType?: string;
}
interface ReleasePleaseConfig {
  releaseType?: string;
  branches?: ReleasePleaseBranchConfig[];
}

interface SyncRepoSettingsBranchConfig {
  pattern: string;
}
interface SyncRepoSettingsConfig {
  branchProtectionRules: SyncRepoSettingsBranchConfig[];
}

export class Runner {
  branchName: string;
  targetTag: string;
  releaseType: string | undefined;
  octokit: Octokit;
  upstreamRepo: string;
  upstreamOwner: string;

  constructor(options: RunnerOptions) {
    this.branchName = options.branchName;
    this.targetTag = options.targetTag;
    this.releaseType = options.releaseType;
    this.octokit = new Octokit({auth: options.gitHubToken});
    this.upstreamRepo = options.upstreamRepo;
    this.upstreamOwner = options.upstreamOwner;
  }

  async getTargetSha(tag: string): Promise<string | undefined> {
    const resp = await this.octokit.git.listMatchingRefs({
      owner: this.upstreamOwner,
      repo: this.upstreamRepo,
      ref: `tags/${this.targetTag}`,
    });
    return resp.data.find(ref => {
      return ref.ref === `refs/tags/${tag}`;
    })?.object.sha;
  }

  async getBranch(branchName: string): Promise<string | undefined> {
    try {
      const existing = await this.octokit.git.getRef({
        owner: this.upstreamOwner,
        repo: this.upstreamRepo,
        ref: `heads/${branchName}`,
      });
      return existing.data.ref;
    } catch (e) {
      if (e.status === 404) {
        return undefined;
      }
      throw e;
    }
  }

  async createBranch(): Promise<string> {
    const existing = await this.getBranch(this.branchName);
    if (existing) {
      console.log(`branch ${this.branchName} already exists`);
      return existing;
    }

    const sha = await this.getTargetSha(this.targetTag);
    if (!sha) {
      console.log(`couldn't find SHA for tag ${this.targetTag}`);
      throw new Error(`couldn't find SHA for tag ${this.targetTag}`);
    }

    console.log(`creating branch ${this.branchName} as SHA ${sha}`);
    const response = await this.octokit.git.createRef({
      owner: this.upstreamOwner,
      repo: this.upstreamRepo,
      ref: `refs/heads/${this.branchName}`,
      sha,
    });
    return response.data.object.sha;
  }

  async getFileContents(path: string): Promise<string | undefined> {
    try {
      const response = (await this.octokit.repos.getContent({
        owner: this.upstreamOwner,
        repo: this.upstreamRepo,
        path,
      })) as {data: {content: string}};
      return Buffer.from(response.data.content, 'base64').toString('utf8');
    } catch (e) {
      if (e.status === 404) {
        return undefined;
      }
      throw e;
    }
  }

  updateReleasePleaseConfig(content: string): string | undefined {
    const config = yaml.load(content) as ReleasePleaseConfig;
    const branches = config.branches || [];
    delete config.branches;

    if (
      branches.find(branch => {
        return branch.branch === this.branchName;
      })
    ) {
      // already found branch
      return undefined;
    }
    const newConfig = yaml.load(content) as ReleasePleaseConfig;
    const newBranchConfig: ReleasePleaseBranchConfig = {
      ...config,
      branch: this.branchName,
    };
    if (this.releaseType) {
      newBranchConfig.releaseType = this.releaseType;
    }
    branches.push(newBranchConfig);
    newConfig.branches = branches;
    return yaml.dump(newConfig);
  }

  updateSyncRepoSettings(content: string): string | undefined {
    const config = yaml.load(content) as SyncRepoSettingsConfig;
    const branches = config.branchProtectionRules || [];
    if (
      branches.find(branch => {
        return branch.pattern === this.branchName;
      })
    ) {
      // already found branch
      return undefined;
    }
    const found = branches[0];
    const newRule = {
      ...found,
      pattern: this.branchName,
    };
    config.branchProtectionRules.push(newRule);
    return yaml.dump(config);
  }

  async createPullRequest(): Promise<number> {
    const changes: Changes = new Map();

    let content = await this.getFileContents('.github/release-please.yml');
    if (content) {
      const newContent = this.updateReleasePleaseConfig(content);
      if (newContent) {
        changes.set('.github/release-please.yml', {
          mode: '100644',
          content: yaml.dump(newContent),
        });
      }
    }

    content = await this.getFileContents('.github/sync-repo-settings.yaml');
    if (content) {
      const newContent = this.updateSyncRepoSettings(content);
      if (newContent) {
        changes.set('.github/sync-repo-settings.yaml', {
          mode: '100644',
          content: yaml.dump(newContent, {
            noRefs: true,
            condenseFlow: true,
          }),
        });
      }
    }

    const message = `build: configure branch ${this.branchName} as a release branch`;
    await createPullRequest(this.octokit, changes, {
      upstreamRepo: this.upstreamRepo,
      upstreamOwner: this.upstreamOwner,
      message,
      title: message,
      description: 'enable releases',
      branch: `release-brancher/${this.branchName}`,
      force: true,
    });
    return 123;
  }
}
