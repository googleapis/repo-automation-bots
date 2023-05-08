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

import {PullRequest} from '../interfaces';
import {
  checkAuthor,
  checkTitleOrBody,
  reportIndividualChecks,
} from '../utils-for-pr-checking';
import {getFileContent} from '../get-pr-info';
import {Octokit} from '@octokit/rest';
import {BaseLanguageRule} from './base';

/**
 * The OwlBotTemplateChanges class's checkPR function returns
 * true if the PR:
  - has an author that is 'gcf-owl-bot[bot]'
  - has a title that does NOT include feat, fix, or !
  - has a title that contains `[autoapprove]` somewhere inside it
  - has a PR body that contains 'PiperOrigin-RevId'
  - is in a repo that has a .repo-metadata.json that contains "library_type": "GAPIC_AUTO"
 */
export class OwlBotTemplateChanges extends BaseLanguageRule {
  classRule = {
    author: 'gcf-owl-bot[bot]',
    // For this particular rule, we want to check a pattern and an antipattern;
    // we want fix/feat/! to not be in the title, and we do want [autoapprove] to
    // be in the title
    titleRegex: /\[autoapprove\]/,
    titleRegexExclude: /(fix|feat|!)/,
    bodyRegex: /PiperOrigin-RevId/,
  };

  constructor(octokit: Octokit) {
    super(octokit);
  }

  public async checkPR(incomingPR: PullRequest): Promise<boolean> {
    const authorshipMatches = checkAuthor(
      this.classRule.author,
      incomingPR.author
    );

    const titleMatches =
      // We don't want it to include fix, feat, or !
      !checkTitleOrBody(incomingPR.title, this.classRule.titleRegexExclude) &&
      // We do want it to include [autoapprove] in title
      checkTitleOrBody(incomingPR.title, this.classRule.titleRegex);

    let bodyMatches = true;
    if (incomingPR.body) {
      bodyMatches = checkTitleOrBody(incomingPR.body, this.classRule.bodyRegex);
    }

    const fileContent = await getFileContent(
      incomingPR.repoOwner,
      incomingPR.repoName,
      '.repo-metadata.json',
      this.octokit
    );

    const isGAPIC = JSON.parse(fileContent).library_type === 'GAPIC_AUTO';

    reportIndividualChecks(
      ['authorshipMatches', 'titleMatches', 'bodyMatches', 'isGAPIC'],
      [authorshipMatches, titleMatches, !bodyMatches, isGAPIC],
      incomingPR.repoOwner,
      incomingPR.repoName,
      incomingPR.prNumber
    );

    // We are looking for an antipattern, i.e., if title does not include fix or feat, and if body dodes not include PiperOrigin
    return authorshipMatches && titleMatches && !bodyMatches && isGAPIC;
  }
}
