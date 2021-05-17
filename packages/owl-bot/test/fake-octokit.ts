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

import {OctokitFactory, OctokitType} from '../src/octokit-util';

// Use anys to mock parts of the octokit API.
// We'll still see compile time errors if in the src/ code if there's a type error
// calling the octokit APIs.
/* eslint-disable @typescript-eslint/no-explicit-any */
export class FakeIssues {
  issues: any[] = [];
  updates: any[] = [];

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
}

export class FakePulls {
  pulls: any[] = [];

  list() {
    return Promise.resolve({data: this.pulls});
  }

  create(pull: any) {
    this.pulls.push(pull);
    return Promise.resolve({
      data: {html_url: `http://github.com/fake/pulls/${this.pulls.length}`},
    });
  }
}

export function newFakeOctokit(
  pulls?: FakePulls,
  issues?: FakeIssues,
  default_branch = 'main'
): OctokitType {
  return ({
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
  } as unknown) as OctokitType;
}

export function newFakeOctokitFactory(
  octokit?: OctokitType,
  token = 'b3'
): OctokitFactory {
  const factory: OctokitFactory = {
    getGitHubShortLivedAccessToken: () => Promise.resolve(token),
    getShortLivedOctokit: () => Promise.resolve(octokit ?? newFakeOctokit()),
  };
  return factory;
}
