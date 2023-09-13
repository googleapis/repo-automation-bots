// Copyright 2023 Google LLC
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
import {LanguageRule, PullRequest} from '../interfaces';
import {GCFLogger, logger as defaultLogger} from 'gcf-utils';

/**
 * This represents the abstract class that will be implemented by
 * each subprocess; it takes an instantiated octokit instance, and it
 * is required implement the checkPR function that returns whether or not
 * the PR conforms to its rules.
 */
export abstract class BaseLanguageRule implements LanguageRule {
  octokit: Octokit;
  logger: GCFLogger;

  constructor(octokit: Octokit, logger: GCFLogger = defaultLogger) {
    this.octokit = octokit;
    this.logger = logger;
  }

  /**
   * This check returns true if the PR corresponds to the rules of a given
   * process, and is safe to automerge; it returns false otherwise.
   *
   * @param pullRequest an object that represents a pull request
   * @returns true if a PR conforms to the rules of a given subprocess, or false otherwise
   */
  abstract checkPR(pullRequest: PullRequest): Promise<boolean>;
}
