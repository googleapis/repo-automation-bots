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
  checkFilePathsMatch,
  reportIndividualChecks,
} from '../utils-for-pr-checking';
import {Octokit} from '@octokit/rest';
import {BaseLanguageRule} from './base';

/**
 * The UpdateDiscoveryArtifacts class's checkPR function returns
 * true if the PR:
  - has an author that is 'yoshi-code-bot'
  - has a title that starts with 'chore: Update discovery artifacts'
  - has Max 2 files changed
  - Each file path must match one of these regexps:
    - /^docs\/dyn\/index\.md$/
    - /^docs\/dyn\/.*\.html$/
    - /^googleapiclient\/discovery_cache\/documents\/.*\.json$/
 */
export class UpdateDiscoveryArtifacts extends BaseLanguageRule {
  classRule = {
    author: 'yoshi-code-bot',
    titleRegex: /^chore: Update discovery artifacts/,
    fileNameRegex: [
      /^docs\/dyn\/index\.md$/,
      /^docs\/dyn\/.*\.html$/,
      /^googleapiclient\/discovery_cache\/documents\/.*\.json$/,
    ],
  };

  constructor(octokit: Octokit) {
    super(octokit);
  }

  public async checkPR(incomingPR: PullRequest): Promise<boolean> {
    const authorshipMatches = checkAuthor(
      this.classRule.author,
      incomingPR.author
    );

    const titleMatches = checkTitleOrBody(
      incomingPR.title,
      this.classRule.titleRegex
    );

    const filePatternsMatch = checkFilePathsMatch(
      incomingPR.changedFiles.map(x => x.filename),
      this.classRule.fileNameRegex
    );

    reportIndividualChecks(
      [
        'authorshipMatches',
        'titleMatches',
        'fileCountMatches',
        'filePatternsMatch',
      ],
      [authorshipMatches, titleMatches, filePatternsMatch],
      incomingPR.repoOwner,
      incomingPR.repoName,
      incomingPR.prNumber
    );

    return authorshipMatches && titleMatches && filePatternsMatch;
  }
}
