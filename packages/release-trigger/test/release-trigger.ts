// Copyright 2020 Google LLC
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

import {describe, it, beforeEach} from 'mocha';

describe('release-trigger', () => {
  describe('findPendingReleasePullRequests', () => {
    it('should paginate through pull requests', async () => {

    });

    it('should ignore pull requests already triggered', async () => {

    });

    it('should ignore closed, unmerged pull requests', async () => {

    });
  });

  describe('triggerKokoroJob', () => {
    it('should execute autorelease trigger-single command', async () => {

    });

    it('should catch and log an exception', async () => {

    });
  });

  describe('markTriggered', () => {
    it('should add a label to a pull request', async () => {

    });
  });

  describe('markFailed', () => {
    it('should add a label to a pull request', async () => {

    });
  });
});
