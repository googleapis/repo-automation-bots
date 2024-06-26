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
import {OwlBotTemplateChanges} from '../owl-bot-template-changes';

/**
 * The OwlBotTemplateChanges class's checkPR function returns
 * true if the PR:
  - has an author that is 'gcf-owl-bot[bot]'
  - has a title that does NOT include BREAKING, or !
  - has a PR body that does not contain 'PiperOrigin-RevId'
  - is the first owlbot template PR in a repo (so they are merged in order)
  - has no other commit authors on the PR
 */
export class OwlBotTemplateChangesNode extends OwlBotTemplateChanges {
  classRule = {
    author: 'gcf-owl-bot[bot]',
    // For this particular rule, we want to check a pattern and an antipattern;
    // we want it to start with regular commit convention,
    // and it should not be breaking or fix or feat
    titleRegex: /^(chore|build|tests|refactor)/,
    titleRegexExclude: /(fix|feat|breaking|!)/,
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
      // We don't want it to include breaking or !
      !checkTitleOrBody(incomingPR.title, this.classRule.titleRegexExclude) &&
      // We do want it to have a conventional commit title
      checkTitleOrBody(incomingPR.title, this.classRule.titleRegex);

    let bodyMatches = true;
    if (incomingPR.body) {
      bodyMatches = checkTitleOrBody(incomingPR.body, this.classRule.bodyRegex);
    }

    const openOwlBotPRs = await getOpenPRsInRepoFromSameAuthor(
      incomingPR.repoOwner,
      incomingPR.repoName,
      incomingPR.author,
      this.octokit
    );

    let otherOwlBotPRs = true;
    if (
      openOwlBotPRs.length > 0 &&
      incomingPR.prNumber === openOwlBotPRs[0].number
    ) {
      otherOwlBotPRs = false;
    }

    const commitsOnPR = await listCommitsOnAPR(
      incomingPR.repoOwner,
      incomingPR.repoName,
      incomingPR.prNumber,
      this.octokit
    );

    const commitAuthors = commitsOnPR.map(x => x.author?.login);

    const membersOfOrg = (
      await this.octokit.rest.orgs.listMembers({
        org: 'googleapis',
      })
    ).data;

    // Assume there are no other commitAuthors on the PR
    let otherCommitAuthors = false;

    for (const author of commitAuthors) {
      // If one of the authors is not allowed AND it is not a part of googleapis,
      // then set commitAuthors to true
      if (
        author !== this.classRule.author &&
        !membersOfOrg.find(x => {
          return x.login === author;
        })
      ) {
        otherCommitAuthors = true;
        break;
      }
    }

    reportIndividualChecks(
      [
        'authorshipMatches',
        'titleMatches',
        'bodyMatches',
        'otherOwlBotPRs',
        'otherCommitAuthors',
      ],
      [
        authorshipMatches,
        titleMatches,
        !bodyMatches,
        !otherOwlBotPRs,
        !otherCommitAuthors,
      ],
      incomingPR.repoOwner,
      incomingPR.repoName,
      incomingPR.prNumber
    );

    // We are looking for an antipattern, i.e., if title does not include fix or feat, and if body does not include PiperOrigin and no other owlBot PRs and no other commit authors
    return (
      authorshipMatches &&
      titleMatches &&
      !bodyMatches &&
      !otherOwlBotPRs &&
      !otherCommitAuthors
    );
  }
}
