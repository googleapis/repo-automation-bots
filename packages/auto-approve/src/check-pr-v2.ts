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
import {PythonSampleAppDependency} from './process-checks/sample-application-repos/python-dependency';
import {JavaSampleAppDependency} from './process-checks/sample-application-repos/java-dependency';
import {GoDependency} from './process-checks/sample-application-repos/go-dependency';
import {DockerDependency} from './process-checks/sample-application-repos/docker-dependency';
import {NodeDependency} from './process-checks/node/dependency';
import {NodeGeneratorDependency} from './process-checks/node/generator-dependency';
import {NodeRelease} from './process-checks/node/release';
import {OwlBotTemplateChangesNode} from './process-checks/node/owlbot-template-changes';
import {OwlBotNode} from './process-checks/node/owlbot';
import {JavaDependency} from './process-checks/java/dependency';
import {OwlBotTemplateChanges} from './process-checks/owl-bot-template-changes';
import {OwlBotAPIChanges} from './process-checks/owl-bot-api-changes';
import {JavaApiaryCodegen} from './process-checks/java/apiary-codegen';
import {PHPApiaryCodegen} from './process-checks/php/apiary-codegen';
import {PythonSampleDependency} from './process-checks/python/sample-dependency';
import {logger as defaultLogger, GCFLogger} from 'gcf-utils';
import {GoApiaryCodegen} from './process-checks/go/apiary-codegen';
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
    configValue: 'PythonSampleDependency',
    configType: PythonSampleDependency,
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
    configValue: 'OwlBotTemplateChangesNode',
    configType: OwlBotTemplateChangesNode,
  },
  {
    configValue: 'OwlBotPRsNode',
    configType: OwlBotNode,
  },
  {
    configValue: 'JavaApiaryCodegen',
    configType: JavaApiaryCodegen,
  },
  {
    configValue: 'JavaDependency',
    configType: JavaDependency,
  },
  {
    configValue: 'OwlBotTemplateChanges',
    configType: OwlBotTemplateChanges,
  },
  {
    configValue: 'OwlBotAPIChanges',
    configType: OwlBotAPIChanges,
  },
  {
    configValue: 'PHPApiaryCodegen',
    configType: PHPApiaryCodegen,
  },
  {
    configValue: 'PythonSampleAppDependency',
    configType: PythonSampleAppDependency,
  },
  {
    configValue: 'GoDependency',
    configType: GoDependency,
  },
  {
    configValue: 'GoApiaryCodegen',
    configType: GoApiaryCodegen,
  },
  {
    configValue: 'DockerDependency',
    configType: DockerDependency,
  },
  {
    configValue: 'JavaSampleAppDependency',
    configType: JavaSampleAppDependency,
  },
  {
    configValue: 'NodeGeneratorDependency',
    configType: NodeGeneratorDependency,
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
export async function checkPRAgainstConfigV2(
  config: ConfigurationV2,
  pr: PullRequestEvent,
  octokit: Octokit,
  logger: GCFLogger = defaultLogger
): Promise<Boolean> {
  const repoOwner = pr.repository.owner.login;
  const author = pr.pull_request.user.login;
  const repoName = pr.pull_request.base.repo.name;
  const prNumber = pr.number;
  const title = pr.pull_request.title;
  const fileCount = pr.pull_request.changed_files;
  const body = pr.pull_request.body;

  // Get changed files fromPR
  const changedFiles = await getChangedFiles(
    octokit,
    repoOwner,
    repoName,
    prNumber,
    logger
  );

  if (!changedFiles) {
    logger.info(
      `Config does not exist in PR or repo, skipping execution for ${repoOwner}/${repoName}/${prNumber}`
    );
    return false;
  }

  for (const rule of config.processes) {
    const Rule = typeMap.find(x => x.configValue === rule);
    // We can assert we'll find a match, since the config has already passed
    // a check that it corresponds to one of the processes
    const instantiatedRule = new Rule!.configType(octokit);

    const passed = await instantiatedRule.checkPR({
      repoOwner,
      author,
      repoName,
      prNumber,
      title,
      fileCount,
      body,
      changedFiles,
    });

    // Stop early if the PR passes for one of the cases allowed by the config
    if (passed === true) {
      return true;
    }
  }

  // If no match, return false;
  return false;
}
