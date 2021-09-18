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

import nock from 'nock';
import {
  getChangedFiles,
  getBlobFromPRFiles,
  getReviewsCompleted,
  cleanReviews,
} from '../src/get-pr-info';
import {describe, it} from 'mocha';
import assert from 'assert';

const {Octokit} = require('@octokit/rest');

const octokit = new Octokit({
  auth: 'mypersonalaccesstoken123',
});

describe('get PR info tests', async () => {
  describe('getChangedFiles method', async () => {
    it('should return all of the changed files in a given PR', async () => {
      const fileRequest = nock('https://api.github.com')
        .get('/repos/owner/repo/pulls/1/files')
        .reply(200, [
          {filename: 'filename1', sha: '1234'},
          {filename: 'filename2', sha: '5678'},
        ]);
      const files = await getChangedFiles(octokit, 'owner', 'repo', 1);
      fileRequest.done();
      assert.deepStrictEqual(files, [
        {filename: 'filename1', sha: '1234'},
        {filename: 'filename2', sha: '5678'},
      ]);
    });
  });

  describe('get blob from PR files', async () => {
    it('should return the blob of a target file from an array of changed PRs', async () => {
      const blobRequest = nock('https://api.github.com')
        .get('/repos/owner/repo/git/blobs/1234')
        .reply(200, {content: Buffer.from('Hello World!').toString('base64')});

      const blob = await getBlobFromPRFiles(
        octokit,
        'owner',
        'repo',
        [
          {filename: 'filename1', sha: '1234'},
          {filename: 'filename2', sha: '5678'},
        ],
        'filename1'
      );
      blobRequest.done();
      assert.strictEqual(blob, 'Hello World!');
    });

    it('should return undefined if target file is not in the array of files changed', async () => {
      const blob = await getBlobFromPRFiles(
        octokit,
        'owner',
        'repo',
        [
          {filename: 'filename1', sha: '1234'},
          {filename: 'filename2', sha: '5678'},
        ],
        'filename3'
      );
      assert.strictEqual(blob, undefined);
    });
  });

  describe('getReviews method', async () => {
    it('should get all the reviews in a PR', async () => {
      const reviewsRequest = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/pulls/1/reviews')
        .reply(200, [
          {
            user: {login: 'octocat'},
            state: 'APPROVED',
            commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
            id: 12345,
          },
        ]);

      await getReviewsCompleted('testOwner', 'testRepo', 1, octokit);
      reviewsRequest.done();
    });

    it('should only return the most recent reviews', async () => {
      const reviews = [
        {
          user: {login: 'octocat'},
          state: 'COMMENTED',
          commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5d',
          id: 12345,
        },
        {
          user: {login: 'octocat'},
          state: 'APPROVED',
          commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
          id: 12345,
        },
      ];

      const review = cleanReviews(reviews);

      assert.deepStrictEqual(review, [
        {
          user: {login: 'octocat'},
          state: 'APPROVED',
          commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
          id: 12345,
        },
      ]);
    });
  });
});
