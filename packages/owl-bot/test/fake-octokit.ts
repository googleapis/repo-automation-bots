// Copyright 2021 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {OctokitFactory} from '../src/octokit-util';

import {Octokit} from '@octokit/rest';

// Use anys to mock parts of the octokit API.
// We'll still see compile time errors if in the src/ code if there's a type error
// calling the octokit APIs.
/* eslint-disable @typescript-eslint/no-explicit-any */
export class FakeIssues {
  issues: any[] = [];
  updates: any[] = [];
  comments: any[] = [];

  constructor(issues: any[] = []) {
    this.issues = issues;
  }

  listForRepo() {
    return Promise.resolve({data: this.issues});
  }

  create(issue: any) {
    this.issues.push(issue);
    issue.html_url = `http://github.com/fake/issues/${this.issues.length}`;
    return Promise.resolve({data: issue});
  }

  update(issue: any) {
    this.updates.push(issue);
    return Promise.resolve();
  }

  createComment(comment: any) {
    this.comments.push(comment);
    return Promise.resolve();
  }
}

export class FakePulls {
  pulls: any[] = [];
  updates: any[] = [];
  reviewComments: any[] = [];

  list(search: any) {
    return Promise.resolve({data: this.pulls});
  }

  create(pull: any) {
    const pullNumber = this.pulls.length + 1;
    const myPull = {
      number: pullNumber,
      html_url: `http://github.com/fake/pulls/${pullNumber}`,
      ...pull,
    };
    this.pulls.push(myPull);
    return Promise.resolve({
      data: myPull,
    });
  }

  update(pull: any) {
    this.updates.push(pull);
    return Promise.resolve();
  }

  createReviewComment(comment: any) {
    this.reviewComments.push(comment);
    return Promise.resolve();
  }
}

export function newFakeOctokit(
  pulls?: FakePulls,
  issues?: FakeIssues,
  default_branch = 'main',
  deadRefs: unknown[] = []
): Octokit {
  return {
    pulls: pulls ?? new FakePulls(),
    issues: issues ?? new FakeIssues(),
    repos: {
      get() {
        return {
          data: {
            default_branch,
          },
        };
      },
    },
    git: {
      deleteRef(deadRef: unknown) {
        deadRefs.push(deadRef);
      },
    },
  } as unknown as Octokit;
}

export function newFakeOctokitFactory(
  octokit?: Octokit,
  token = 'b3'
): OctokitFactory {
  const factory: OctokitFactory = {
    getGitHubShortLivedAccessToken: () => Promise.resolve(token),
    getShortLivedOctokit: () => Promise.resolve(octokit ?? newFakeOctokit()),
  };
  return factory;
}
