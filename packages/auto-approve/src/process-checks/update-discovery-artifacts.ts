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

import {LanguageRule, File, Process} from '../interfaces';
import {
  checkAuthor,
  checkTitleOrBody,
  checkFilePathsMatch,
  reportIndividualChecks,
} from '../utils-for-pr-checking';
import {Octokit} from '@octokit/rest';

export class UpdateDiscoveryArtifacts extends Process implements LanguageRule {
  classRule: {
    author: string;
    titleRegex?: RegExp;
    fileNameRegex?: RegExp[];
    fileRules?: [
      {
        oldVersion?: RegExp;
        newVersion?: RegExp;
        dependencyTitle?: RegExp;
        targetFileToCheck: RegExp;
      }
    ];
  };

  constructor(
    incomingPrAuthor: string,
    incomingTitle: string,
    incomingFileCount: number,
    incomingChangedFiles: File[],
    incomingRepoName: string,
    incomingRepoOwner: string,
    incomingPrNumber: number,
    incomingOctokit: Octokit,
    incomingBody?: string
  ) {
    super(
      incomingPrAuthor,
      incomingTitle,
      incomingFileCount,
      incomingChangedFiles,
      incomingRepoName,
      incomingRepoOwner,
      incomingPrNumber,
      incomingOctokit,
      incomingBody
    ),
      (this.classRule = {
        author: 'yoshi-code-bot',
        titleRegex: /^chore: Update discovery artifacts/,
        fileNameRegex: [
          /^docs\/dyn\/index\.md$/,
          /^docs\/dyn\/.*\.html$/,
          /^googleapiclient\/discovery_cache\/documents\/.*\.json$/,
        ],
      });
  }

  public async checkPR(): Promise<boolean> {
    const authorshipMatches = checkAuthor(
      this.classRule.author,
      this.incomingPR.author
    );

    const titleMatches = checkTitleOrBody(
      this.incomingPR.title,
      this.classRule.titleRegex
    );

    const filePatternsMatch = checkFilePathsMatch(
      this.incomingPR.changedFiles.map(x => x.filename),
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
      this.incomingPR.repoOwner,
      this.incomingPR.repoName,
      this.incomingPR.prNumber
    );

    return authorshipMatches && titleMatches && filePatternsMatch;
  }
}
