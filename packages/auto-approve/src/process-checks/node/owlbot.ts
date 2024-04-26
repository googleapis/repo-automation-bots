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

import {PullRequest} from '../../interfaces';
import {
  checkAuthor,
  checkTitleOrBody,
  reportIndividualChecks,
  getOpenPRsInRepoFromSameAuthor,
} from '../../utils-for-pr-checking';
import {listCommitsOnAPR} from '../../get-pr-info';
import {Octokit} from '@octokit/rest';
import {OwlBotTemplateChangesNode} from './owlbot-template-changes';

/**
 * The OwlBotTemplateChanges class's checkPR function returns
 * true if the PR:
  - has an author that is 'gcf-owl-bot[bot]'
  - has a title that does NOT include BREAKING, or !
  - has a PR body that DOES contain 'PiperOrigin-RevId'
  - is the first owlbot template PR in a repo (so they are merged in order)
  - has no other commit authors on the PR
 */
export class OwlBotNode extends OwlBotTemplateChangesNode {
  classRule = {
    author: 'gcf-owl-bot[bot]',
    // For this particular rule, we want to check a pattern and an antipattern;
    // we want it to start with regular commit convention,
    // and it should not be breaking or fix or feat
    titleRegex: /^(chore|build|tests|refactor)/,
    titleRegexExclude: /(fix|feat|breaking|!)/,
    bodyRegex: /^((?!PiperOrigin-RevId).)*$/,
  };

  constructor(octokit: Octokit) {
    super(octokit);
  }

  public async checkPR(incomingPR: PullRequest): Promise<boolean> {
    return super.checkPR(incomingPR);
  }
}
