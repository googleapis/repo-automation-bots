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

// eslint-disable-next-line node/no-extraneous-import
import {PullRequestEvent} from '@octokit/webhooks-types/schema';
import {getChangedFiles} from './get-pr-info';
import {Octokit} from '@octokit/rest';
import {ConfigurationV2} from './interfaces';
import {UpdateDiscoveryArtifacts} from './process-checks/update-discovery-artifacts';
import {RegenerateReadme} from './process-checks/regenerate-readme';
import {DiscoveryDocUpdate} from './process-checks/discovery-doc-update';
import {PythonDependency} from './process-checks/python/dependency';
import {NodeDependency} from './process-checks/node/dependency';
import {NodeRelease} from './process-checks/node/release';
import {JavaDependency} from './process-checks/java/dependency';
// This file manages the logic to check whether a given PR matches the config in the repository

// We need this typeMap to convert the JSON input (string) into a corresponding type.
const typeMap = [
  {
    configValue: 'UpdateDiscoveryArtifacts',
    configType: UpdateDiscoveryArtifacts,
  },
  {
    configValue: 'RegenerateReadme',
    configType: RegenerateReadme,
  },
  {
    configValue: 'DiscoveryDocUpdate',
    configType: DiscoveryDocUpdate,
  },
  {
    configValue: 'PythonDependency',
    configType: PythonDependency,
  },
  {
    configValue: 'NodeDependency',
    configType: NodeDependency,
  },
  {
    configValue: 'NodeRelease',
    configType: NodeRelease,
  },
  {
    configValue: 'JavaDependency',
    configType: JavaDependency,
  },
];

/**
 * Checks that a given PR matches the rules in the auto-approve.yml file in the repository
 *
 * @param config the config in the repository
 * @param pr the incoming PR
 * @param octokit the Octokit instance on which to make calls to the Github API
 * @returns true if PR matches config appropriately, false if not
 */
export async function checkPRAgainstConfig(
  config: ConfigurationV2,
  pr: PullRequestEvent,
  octokit: Octokit
): Promise<Boolean> {
  const repoOwner = pr.repository.owner.login;
  const prAuthor = pr.pull_request.user.login;
  const repo = pr.pull_request.base.repo.name;
  const prNumber = pr.number;
  const title = pr.pull_request.title;
  const fileCount = pr.pull_request.changed_files;

  // Get changed files fromPR
  const changedFiles = await getChangedFiles(
    octokit,
    repoOwner,
    repo,
    prNumber
  );

  for (const rule of config.processes) {
    const Rule = typeMap.find(x => x.configValue === rule);
    // We can assert we'll find a match, since the config has already passed
    // a check that it corresponds to one of the processes
    const instantiatedRule = new Rule!.configType(
      prAuthor,
      title,
      fileCount,
      changedFiles,
      repo,
      repoOwner,
      prNumber
    );

    const passed = instantiatedRule.checkPR();

    // Stop early if the PR passes for one of the cases allowed by the config
    if (passed === true) {
      return true;
    }
  }

  // If no match, return false;
  return false;
}
