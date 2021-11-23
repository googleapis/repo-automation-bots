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
import {PullRequestEvent} from '@octokit/webhooks-types/schema';
import {UpdateDiscoveryArtifacts} from './process-checks/update-discovery-artifacts';
import {RegenerateReadme} from './process-checks/regenerate-readme';
import {DiscoveryDocUpdate} from './process-checks/discovery-doc-update';
import {PythonDependency} from './process-checks/python/dependency';
import {NodeDependency} from './process-checks/node/dependency';
import {NodeRelease} from './process-checks/node/release';
import {JavaDependency} from './process-checks/java/dependency';

/**
 * Interface for rules in each languages' PERMITTED_FILES list. These
 * are rules for files that match an author and filename, and then provide
 * regex for the versions for those particular formats.
 */
export interface FileSpecificRule {
  prAuthor: string;
  process?: string;
  title?: RegExp;
  targetFile: RegExp;
  oldVersion: RegExp;
  newVersion: RegExp;
}

/**
 * Interface for rules in each processes' classRule. These
 * are rules for files that match an author and filename, and then provide
 * regex for the versions for those particular formats.
 */
export interface FileRule {
  oldVersion?: RegExp;
  newVersion?: RegExp;
  dependencyTitle?: RegExp;
  targetFileToCheck: RegExp;
}

/**
 * Interface for the versions found in the selected files. These versions are
 * picked out based on the regex listed in `./language-versioning-rules.json` for
 * that particular file. From there, you will get the previous dependency, new
 * dependency, and previous version number and changed version number.
 */
export interface Versions {
  oldDependencyName: string;
  newDependencyName: string;
  oldMajorVersion: string;
  oldMinorVersion: string;
  newMajorVersion: string;
  newMinorVersion: string;
}

/**
 * Class interface for language-specific rules. These methods ensure that a given language
 * provides a process for deciding whether a release-type, dependency-type pr passes language-specific additional
 * checks, and then overall confirms if that PR passes additional checks for its given language.
 */
export interface LanguageRule {
  checkPR(): boolean;
  incomingPR: {
    author: string;
    title: string;
    fileCount: number;
    changedFiles: File[];
    repoName: string;
    repoOwner: string;
    prNumber: number;
  };
  classRule: {
    author: string;
    titleRegex?: RegExp;
    fileNameRegex?: RegExp[];
    maxFiles?: number;
    fileRules?: FileRule[];
  };
}

/**
 * Interface for reviews returned from Github with the pulls.listReviews method.
 */
export interface Reviews {
  user: {
    login: string;
  };
  state: string;
  commit_id: string;
  id: number;
}

/**
 * Interface for File-specific informationreturned from Github with the pulls.listFiles method
 */
export interface File {
  sha: string;
  filename: string;
  patch?: string;
  additions?: number;
  deletions?: number;
  changes?: number;
}

/**
 * Interface for a rule in a configuration that conforms to the valid-pr-schema.json rules
 */
export interface ValidPr {
  author: string;
  title: string;
  changedFiles?: string[];
  maxFiles?: number;
}

/**
 * Interface for a GH file (to differentiate when GH returns a folder)
 */
export interface GHFile {
  content: string | undefined;
}

//   type Constants = typeof Constants[keyof typeof Constants]
//   const Constants = {
//     updateDiscoveryArtifacts = UpdateDiscoveryArtifacts,
//     regenerateReadme = RegenerateReadme,
//     discoveryDocUpdate = DiscoveryDocUpdate,
//     pythonDependency = PythonDependency,
//     nodeDependency = NodeDependency,
//     nodeRelease = NodeRelease,
//     javaDependency = JavaDependency
//   } as const;
export enum Processes {
  updateDiscoveryArtifacts = 'UpdateDiscoveryArtifacts',
  RegenerateReadme = 'RegenerateReadme',
  discoveryDocUpdate = 'DiscoveryDocUpdate',
  pythonDependency = 'PythonDependency',
  nodeDependency = 'NodeDependency',
  nodeRelease = 'NodeRelease',
  javaDependency = 'JavaDependency',
}
/**
 * Interface for an auto-approve.yml configuration (repo/auto-approve.yml)
 */
export interface Configuration {
  rules: ValidPr[];
}

/**
 * Interface for an auto-approve.yml configuration (repo/auto-approve.yml)
 */
export interface ConfigurationV2 {
  processes: (
    | Constructable<UpdateDiscoveryArtifacts>
    | Constructable<RegenerateReadme>
    | Constructable<DiscoveryDocUpdate>
    | Constructable<PythonDependency>
    | Constructable<NodeDependency>
    | Constructable<NodeRelease>
    | Constructable<JavaDependency>
  )[];
}

interface Constructable<T> {
  new (...args: any): T;
}
