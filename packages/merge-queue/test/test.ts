// Copyright 2022 Google LLC
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

/* eslint-disable node/no-extraneous-import */

import {GCFBootstrapper} from 'gcf-utils';

import {createAppFn} from '../src/merge-queue';
import {Probot, createProbot, ProbotOctokit} from 'probot';
import nock from 'nock';
import {describe, it, beforeEach} from 'mocha';

nock.disableNetConnect();

describe('merge-queue', () => {
  let probot: Probot;
  const bootstrap = new GCFBootstrapper({
    taskTargetEnvironment: 'run',
  });

  beforeEach(() => {
    probot = createProbot({
      defaults: {
        githubToken: 'abc123',
        Octokit: ProbotOctokit.defaults({
          retry: {enabled: false},
          throttle: {enabled: false},
        }),
      }
    });
    probot.load(createAppFn(bootstrap));
  });

  describe('responds to events', () => {
    it('works', () => {
    });
  });
});
