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

import {OwlBotAPIChanges} from '../src/process-checks/owl-bot-api-changes';
import {describe, it} from 'mocha';
import assert from 'assert';
import nock from 'nock';

const {Octokit} = require('@octokit/rest');

const octokit = new Octokit({
  auth: 'mypersonalaccesstoken123',
});

function getPRsOnRepo(
  owner: string,
  repo: string,
  response: {id: number; user: {login: string}}[]
) {
  return nock('https://api.github.com')
    .get(`/repos/${owner}/${repo}/pulls?state=open`)
    .reply(200, response);
}

function getFileOnARepo(
  owner: string,
  repo: string,
  path: string,
  response: {name: string; content: string}
) {
  return nock('https://api.github.com')
    .get(`/repos/${owner}/${repo}/contents/${path}`)
    .reply(200, response);
}

function listCommitsOnAPR(
  owner: string,
  repo: string,
  response: {author: {login: string}}[]
) {
  return nock('https://api.github.com')
    .get(`/repos/${owner}/${repo}/pulls/1/commits`)
    .reply(200, response);
}

describe('behavior of OwlBotAPIChanges process', () => {
  it('should get constructed with the appropriate values', () => {
    const owlBotTemplateChanges = new OwlBotAPIChanges(
      'testAuthor',
      'testTitle',
      3,
      [{filename: 'hello', sha: '2345'}],
      'testRepoName',
      'testRepoOwner',
      1,
      octokit,
      'body'
    );

    const expectation = {
      incomingPR: {
        author: 'testAuthor',
        title: 'testTitle',
        fileCount: 3,
        changedFiles: [{filename: 'hello', sha: '2345'}],
        repoName: 'testRepoName',
        repoOwner: 'testRepoOwner',
        prNumber: 1,
        body: 'body',
      },
      classRule: {
        author: 'gcf-owl-bot[bot]',
        titleRegex: /(breaking|BREAKING|!)/,
        bodyRegex: /PiperOrigin-RevId/,
      },
      octokit,
    };

    assert.deepStrictEqual(
      owlBotTemplateChanges.incomingPR,
      expectation.incomingPR
    );
    assert.deepStrictEqual(
      owlBotTemplateChanges.classRule,
      expectation.classRule
    );
    assert.deepStrictEqual(owlBotTemplateChanges.octokit, octokit);
  });

  it('should return false in checkPR if incoming PR does not match classRules', async () => {
    const owlBotAPIChanges = new OwlBotAPIChanges(
      'testAuthor',
      'testTitle',
      3,
      [{filename: 'hello', sha: '2345'}],
      'testRepoName',
      'testRepoOwner',
      1,
      octokit,
      'body'
    );

    const scopes = [
      getFileOnARepo('testRepoOwner', 'testRepoName', '.repo-metadata.json', {
        name: '.repo-metadata.json',
        content:
          'ewogICAgIm5hbWUiOiAiZGxwIiwKICAgICJuYW1lX3ByZXR0eSI6ICJDbG91ZCBEYXRhIExvc3MgUHJldmVudGlvbiIsCiAgICAicHJvZHVjdF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9kbHAvZG9jcy8iLAogICAgImNsaWVudF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9weXRob24vZG9jcy9yZWZlcmVuY2UvZGxwL2xhdGVzdCIsCiAgICAiaXNzdWVfdHJhY2tlciI6ICIiLAogICAgInJlbGVhc2VfbGV2ZWwiOiAiZ2EiLAogICAgImxhbmd1YWdlIjogInB5dGhvbiIsCiAgICAibGlicmFyeV90eXBlIjogIkdBUElDX0FVVE8iLAogICAgInJlcG8iOiAiZ29vZ2xlYXBpcy9weXRob24tZGxwIiwKICAgICJkaXN0cmlidXRpb25fbmFtZSI6ICJnb29nbGUtY2xvdWQtZGxwIiwKICAgICJhcGlfaWQiOiAiZGxwLmdvb2dsZWFwaXMuY29tIiwKICAgICJyZXF1aXJlc19iaWxsaW5nIjogdHJ1ZSwKICAgICJkZWZhdWx0X3ZlcnNpb24iOiAidjIiLAogICAgImNvZGVvd25lcl90ZWFtIjogIiIKfQ==',
      }),
      getPRsOnRepo('testRepoOwner', 'testRepoName', [
        {id: 1, user: {login: 'anotherAuthor'}},
      ]),
      listCommitsOnAPR('testRepoOwner', 'testRepoName', [
        {author: {login: 'testAuthor'}},
      ]),
    ];

    assert.deepStrictEqual(await owlBotAPIChanges.checkPR(), false);
    scopes.forEach(scope => scope.done());
  });

  it('should return false in checkPR if incoming PR includes a breaking change', async () => {
    const owlBotTemplateChanges = new OwlBotAPIChanges(
      'gcf-owl-bot[bot]',
      'breaking change: a thing',
      3,
      [{filename: 'hello', sha: '2345'}],
      'testRepoName',
      'testRepoOwner',
      1,
      octokit,
      '... signature to CreateFeatureStore, CreateEntityType, CreateFeature feat: add network and enable_private_service_connect to IndexEndpoint feat: add service_attachment to IndexPrivateEndpoints feat: add stratified_split field to training_pipeline InputDataConfig fix: remove invalid resource annotations in LineageSubgraph' +
        'Regenerate this pull request now.' +
        'PiperOrigin-RevId: 413686247' +
        'Source-Link: googleapis/googleapis@244a89d' +
        'Source-Link: googleapis/googleapis-gen@c485e44' +
        'Copy-Tag: eyJwIjoiLmdpdGh1Yi8uT3dsQm90LnlhbWwiLCJoIjoiYzQ4NWU0NGExYjJmZWY1MTZlOWJjYTM2NTE0ZDUwY2ViZDVlYTUxZiJ9'
    );

    const scopes = [
      getFileOnARepo('testRepoOwner', 'testRepoName', '.repo-metadata.json', {
        name: '.repo-metadata.json',
        content:
          'ewogICAgIm5hbWUiOiAiZGxwIiwKICAgICJuYW1lX3ByZXR0eSI6ICJDbG91ZCBEYXRhIExvc3MgUHJldmVudGlvbiIsCiAgICAicHJvZHVjdF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9kbHAvZG9jcy8iLAogICAgImNsaWVudF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9weXRob24vZG9jcy9yZWZlcmVuY2UvZGxwL2xhdGVzdCIsCiAgICAiaXNzdWVfdHJhY2tlciI6ICIiLAogICAgInJlbGVhc2VfbGV2ZWwiOiAiZ2EiLAogICAgImxhbmd1YWdlIjogInB5dGhvbiIsCiAgICAibGlicmFyeV90eXBlIjogIkdBUElDX0FVVE8iLAogICAgInJlcG8iOiAiZ29vZ2xlYXBpcy9weXRob24tZGxwIiwKICAgICJkaXN0cmlidXRpb25fbmFtZSI6ICJnb29nbGUtY2xvdWQtZGxwIiwKICAgICJhcGlfaWQiOiAiZGxwLmdvb2dsZWFwaXMuY29tIiwKICAgICJyZXF1aXJlc19iaWxsaW5nIjogdHJ1ZSwKICAgICJkZWZhdWx0X3ZlcnNpb24iOiAidjIiLAogICAgImNvZGVvd25lcl90ZWFtIjogIiIKfQ==',
      }),
      getPRsOnRepo('testRepoOwner', 'testRepoName', [
        {id: 1, user: {login: 'anotherAuthor'}},
      ]),
      listCommitsOnAPR('testRepoOwner', 'testRepoName', [
        {author: {login: 'gcf-owl-bot[bot]'}},
      ]),
    ];

    assert.deepStrictEqual(await owlBotTemplateChanges.checkPR(), false);
    scopes.forEach(scope => scope.done());
  });

  it('should return false in checkPR if incoming PR does not include PiperOrigin-RevId', async () => {
    const owlBotTemplateChanges = new OwlBotAPIChanges(
      'gcf-owl-bot[bot]',
      'a fine title',
      3,
      [{filename: 'hello', sha: '2345'}],
      'testRepoName',
      'testRepoOwner',
      1,
      octokit,
      '... signature to CreateFeatureStore, CreateEntityType, CreateFeature feat: add network and enable_private_service_connect to IndexEndpoint feat: add service_attachment to IndexPrivateEndpoints feat: add stratified_split field to training_pipeline InputDataConfig fix: remove invalid resource annotations in LineageSubgraph' +
        'Regenerate this pull request now.' +
        'Source-Link: googleapis/googleapis@244a89d' +
        'Source-Link: googleapis/googleapis-gen@c485e44' +
        'Copy-Tag: eyJwIjoiLmdpdGh1Yi8uT3dsQm90LnlhbWwiLCJoIjoiYzQ4NWU0NGExYjJmZWY1MTZlOWJjYTM2NTE0ZDUwY2ViZDVlYTUxZiJ9'
    );

    const scopes = [
      getFileOnARepo('testRepoOwner', 'testRepoName', '.repo-metadata.json', {
        name: '.repo-metadata.json',
        content:
          'ewogICAgIm5hbWUiOiAiZGxwIiwKICAgICJuYW1lX3ByZXR0eSI6ICJDbG91ZCBEYXRhIExvc3MgUHJldmVudGlvbiIsCiAgICAicHJvZHVjdF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9kbHAvZG9jcy8iLAogICAgImNsaWVudF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9weXRob24vZG9jcy9yZWZlcmVuY2UvZGxwL2xhdGVzdCIsCiAgICAiaXNzdWVfdHJhY2tlciI6ICIiLAogICAgInJlbGVhc2VfbGV2ZWwiOiAiZ2EiLAogICAgImxhbmd1YWdlIjogInB5dGhvbiIsCiAgICAibGlicmFyeV90eXBlIjogIkdBUElDX0FVVE8iLAogICAgInJlcG8iOiAiZ29vZ2xlYXBpcy9weXRob24tZGxwIiwKICAgICJkaXN0cmlidXRpb25fbmFtZSI6ICJnb29nbGUtY2xvdWQtZGxwIiwKICAgICJhcGlfaWQiOiAiZGxwLmdvb2dsZWFwaXMuY29tIiwKICAgICJyZXF1aXJlc19iaWxsaW5nIjogdHJ1ZSwKICAgICJkZWZhdWx0X3ZlcnNpb24iOiAidjIiLAogICAgImNvZGVvd25lcl90ZWFtIjogIiIKfQ==',
      }),
      getPRsOnRepo('testRepoOwner', 'testRepoName', [
        {id: 1, user: {login: 'anotherAuthor'}},
      ]),
      listCommitsOnAPR('testRepoOwner', 'testRepoName', [
        {author: {login: 'gcf-owl-bot[bot]'}},
      ]),
    ];

    assert.deepStrictEqual(await owlBotTemplateChanges.checkPR(), false);
    scopes.forEach(scope => scope.done());
  });

  it('should return false in checkPR if incoming PR is not GAPIC_AUTO', async () => {
    const owlBotTemplateChanges = new OwlBotAPIChanges(
      'gcf-owl-bot[bot]',
      'a fine title',
      3,
      [{filename: 'hello', sha: '2345'}],
      'testRepoName',
      'testRepoOwner',
      1,
      octokit,
      '... signature to CreateFeatureStore, CreateEntityType, CreateFeature feat: add network and enable_private_service_connect to IndexEndpoint feat: add service_attachment to IndexPrivateEndpoints feat: add stratified_split field to training_pipeline InputDataConfig fix: remove invalid resource annotations in LineageSubgraph' +
        'PiperOrigin-RevId: 413686247' +
        'Regenerate this pull request now.' +
        'Source-Link: googleapis/googleapis@244a89d' +
        'Source-Link: googleapis/googleapis-gen@c485e44' +
        'Copy-Tag: eyJwIjoiLmdpdGh1Yi8uT3dsQm90LnlhbWwiLCJoIjoiYzQ4NWU0NGExYjJmZWY1MTZlOWJjYTM2NTE0ZDUwY2ViZDVlYTUxZiJ9'
    );

    const scopes = [
      getFileOnARepo('testRepoOwner', 'testRepoName', '.repo-metadata.json', {
        name: '.repo-metadata.json',
        content:
          'ewogICAgIm5hbWUiOiAiZGxwIiwKICAgICJuYW1lX3ByZXR0eSI6ICJDbG91ZCBEYXRhIExvc3MgUHJldmVudGlvbiIsCiAgICAicHJvZHVjdF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9kbHAvZG9jcy8iLAogICAgImNsaWVudF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9weXRob24vZG9jcy9yZWZlcmVuY2UvZGxwL2xhdGVzdCIsCiAgICAiaXNzdWVfdHJhY2tlciI6ICIiLAogICAgInJlbGVhc2VfbGV2ZWwiOiAiZ2EiLAogICAgImxhbmd1YWdlIjogInB5dGhvbiIsCiAgICAibGlicmFyeV90eXBlIjogIkdBUElDX1ZFTkVFUiIsCiAgICAicmVwbyI6ICJnb29nbGVhcGlzL3B5dGhvbi1kbHAiLAogICAgImRpc3RyaWJ1dGlvbl9uYW1lIjogImdvb2dsZS1jbG91ZC1kbHAiLAogICAgImFwaV9pZCI6ICJkbHAuZ29vZ2xlYXBpcy5jb20iLAogICAgInJlcXVpcmVzX2JpbGxpbmciOiB0cnVlLAogICAgImRlZmF1bHRfdmVyc2lvbiI6ICJ2MiIsCiAgICAiY29kZW93bmVyX3RlYW0iOiAiIgp9',
      }),
      getPRsOnRepo('testRepoOwner', 'testRepoName', [
        {id: 1, user: {login: 'anotherAuthor'}},
      ]),
      listCommitsOnAPR('testRepoOwner', 'testRepoName', [
        {author: {login: 'gcf-owl-bot[bot]'}},
      ]),
    ];

    assert.deepStrictEqual(await owlBotTemplateChanges.checkPR(), false);
    scopes.forEach(scope => scope.done());
  });

  it('should return false in checkPR if incoming PR has other PRs that are also from owl-bot', async () => {
    const owlBotTemplateChanges = new OwlBotAPIChanges(
      'gcf-owl-bot[bot]',
      'a fine title',
      3,
      [{filename: 'hello', sha: '2345'}],
      'testRepoName',
      'testRepoOwner',
      1,
      octokit,
      '... signature to CreateFeatureStore, CreateEntityType, CreateFeature feat: add network and enable_private_service_connect to IndexEndpoint feat: add service_attachment to IndexPrivateEndpoints feat: add stratified_split field to training_pipeline InputDataConfig fix: remove invalid resource annotations in LineageSubgraph' +
        'PiperOrigin-RevId: 413686247' +
        'Regenerate this pull request now.' +
        'Source-Link: googleapis/googleapis@244a89d' +
        'Source-Link: googleapis/googleapis-gen@c485e44' +
        'Copy-Tag: eyJwIjoiLmdpdGh1Yi8uT3dsQm90LnlhbWwiLCJoIjoiYzQ4NWU0NGExYjJmZWY1MTZlOWJjYTM2NTE0ZDUwY2ViZDVlYTUxZiJ9'
    );

    const scopes = [
      getFileOnARepo('testRepoOwner', 'testRepoName', '.repo-metadata.json', {
        name: '.repo-metadata.json',
        content:
          'ewogICAgIm5hbWUiOiAiZGxwIiwKICAgICJuYW1lX3ByZXR0eSI6ICJDbG91ZCBEYXRhIExvc3MgUHJldmVudGlvbiIsCiAgICAicHJvZHVjdF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9kbHAvZG9jcy8iLAogICAgImNsaWVudF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9weXRob24vZG9jcy9yZWZlcmVuY2UvZGxwL2xhdGVzdCIsCiAgICAiaXNzdWVfdHJhY2tlciI6ICIiLAogICAgInJlbGVhc2VfbGV2ZWwiOiAiZ2EiLAogICAgImxhbmd1YWdlIjogInB5dGhvbiIsCiAgICAibGlicmFyeV90eXBlIjogIkdBUElDX0FVVE8iLAogICAgInJlcG8iOiAiZ29vZ2xlYXBpcy9weXRob24tZGxwIiwKICAgICJkaXN0cmlidXRpb25fbmFtZSI6ICJnb29nbGUtY2xvdWQtZGxwIiwKICAgICJhcGlfaWQiOiAiZGxwLmdvb2dsZWFwaXMuY29tIiwKICAgICJyZXF1aXJlc19iaWxsaW5nIjogdHJ1ZSwKICAgICJkZWZhdWx0X3ZlcnNpb24iOiAidjIiLAogICAgImNvZGVvd25lcl90ZWFtIjogIiIKfQ==',
      }),
      getPRsOnRepo('testRepoOwner', 'testRepoName', [
        {id: 1, user: {login: 'gcf-owl-bot[bot]'}},
        {id: 2, user: {login: 'gcf-owl-bot[bot]'}},
      ]),
      listCommitsOnAPR('testRepoOwner', 'testRepoName', [
        {author: {login: 'gcf-owl-bot[bot]'}},
      ]),
    ];

    assert.deepStrictEqual(await owlBotTemplateChanges.checkPR(), false);
    scopes.forEach(scope => scope.done());
  });

  it('should return false in checkPR if incoming PR has commits from other authors', async () => {
    const owlBotTemplateChanges = new OwlBotAPIChanges(
      'gcf-owl-bot[bot]',
      'a fine title',
      3,
      [{filename: 'hello', sha: '2345'}],
      'testRepoName',
      'testRepoOwner',
      1,
      octokit,
      '... signature to CreateFeatureStore, CreateEntityType, CreateFeature feat: add network and enable_private_service_connect to IndexEndpoint feat: add service_attachment to IndexPrivateEndpoints feat: add stratified_split field to training_pipeline InputDataConfig fix: remove invalid resource annotations in LineageSubgraph' +
        'PiperOrigin-RevId: 413686247' +
        'Regenerate this pull request now.' +
        'Source-Link: googleapis/googleapis@244a89d' +
        'Source-Link: googleapis/googleapis-gen@c485e44' +
        'Copy-Tag: eyJwIjoiLmdpdGh1Yi8uT3dsQm90LnlhbWwiLCJoIjoiYzQ4NWU0NGExYjJmZWY1MTZlOWJjYTM2NTE0ZDUwY2ViZDVlYTUxZiJ9'
    );

    const scopes = [
      getFileOnARepo('testRepoOwner', 'testRepoName', '.repo-metadata.json', {
        name: '.repo-metadata.json',
        content:
          'ewogICAgIm5hbWUiOiAiZGxwIiwKICAgICJuYW1lX3ByZXR0eSI6ICJDbG91ZCBEYXRhIExvc3MgUHJldmVudGlvbiIsCiAgICAicHJvZHVjdF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9kbHAvZG9jcy8iLAogICAgImNsaWVudF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9weXRob24vZG9jcy9yZWZlcmVuY2UvZGxwL2xhdGVzdCIsCiAgICAiaXNzdWVfdHJhY2tlciI6ICIiLAogICAgInJlbGVhc2VfbGV2ZWwiOiAiZ2EiLAogICAgImxhbmd1YWdlIjogInB5dGhvbiIsCiAgICAibGlicmFyeV90eXBlIjogIkdBUElDX0FVVE8iLAogICAgInJlcG8iOiAiZ29vZ2xlYXBpcy9weXRob24tZGxwIiwKICAgICJkaXN0cmlidXRpb25fbmFtZSI6ICJnb29nbGUtY2xvdWQtZGxwIiwKICAgICJhcGlfaWQiOiAiZGxwLmdvb2dsZWFwaXMuY29tIiwKICAgICJyZXF1aXJlc19iaWxsaW5nIjogdHJ1ZSwKICAgICJkZWZhdWx0X3ZlcnNpb24iOiAidjIiLAogICAgImNvZGVvd25lcl90ZWFtIjogIiIKfQ==',
      }),
      getPRsOnRepo('testRepoOwner', 'testRepoName', [
        {id: 2, user: {login: 'gcf-owl-bot[bot]'}},
      ]),
      listCommitsOnAPR('testRepoOwner', 'testRepoName', [
        {author: {login: 'anotherAuthor'}},
      ]),
    ];

    assert.deepStrictEqual(await owlBotTemplateChanges.checkPR(), false);
    scopes.forEach(scope => scope.done());
  });

  it('should return true in checkPR if incoming PR does match classRules', async () => {
    const owlBotTemplateChanges = new OwlBotAPIChanges(
      'gcf-owl-bot[bot]',
      'a fine title',
      3,
      [{filename: 'hello', sha: '2345'}],
      'testRepoName',
      'testRepoOwner',
      1,
      octokit,
      '... signature to CreateFeatureStore, CreateEntityType, CreateFeature feat: add network and enable_private_service_connect to IndexEndpoint feat: add service_attachment to IndexPrivateEndpoints feat: add stratified_split field to training_pipeline InputDataConfig fix: remove invalid resource annotations in LineageSubgraph' +
        'PiperOrigin-RevId: 413686247' +
        'Regenerate this pull request now.' +
        'Source-Link: googleapis/googleapis@244a89d' +
        'Source-Link: googleapis/googleapis-gen@c485e44' +
        'Copy-Tag: eyJwIjoiLmdpdGh1Yi8uT3dsQm90LnlhbWwiLCJoIjoiYzQ4NWU0NGExYjJmZWY1MTZlOWJjYTM2NTE0ZDUwY2ViZDVlYTUxZiJ9'
    );

    const scopes = [
      getFileOnARepo('testRepoOwner', 'testRepoName', '.repo-metadata.json', {
        name: '.repo-metadata.json',
        content:
          'ewogICAgIm5hbWUiOiAiZGxwIiwKICAgICJuYW1lX3ByZXR0eSI6ICJDbG91ZCBEYXRhIExvc3MgUHJldmVudGlvbiIsCiAgICAicHJvZHVjdF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9kbHAvZG9jcy8iLAogICAgImNsaWVudF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9weXRob24vZG9jcy9yZWZlcmVuY2UvZGxwL2xhdGVzdCIsCiAgICAiaXNzdWVfdHJhY2tlciI6ICIiLAogICAgInJlbGVhc2VfbGV2ZWwiOiAiZ2EiLAogICAgImxhbmd1YWdlIjogInB5dGhvbiIsCiAgICAibGlicmFyeV90eXBlIjogIkdBUElDX0FVVE8iLAogICAgInJlcG8iOiAiZ29vZ2xlYXBpcy9weXRob24tZGxwIiwKICAgICJkaXN0cmlidXRpb25fbmFtZSI6ICJnb29nbGUtY2xvdWQtZGxwIiwKICAgICJhcGlfaWQiOiAiZGxwLmdvb2dsZWFwaXMuY29tIiwKICAgICJyZXF1aXJlc19iaWxsaW5nIjogdHJ1ZSwKICAgICJkZWZhdWx0X3ZlcnNpb24iOiAidjIiLAogICAgImNvZGVvd25lcl90ZWFtIjogIiIKfQ==',
      }),
      getPRsOnRepo('testRepoOwner', 'testRepoName', [
        {id: 2, user: {login: 'gcf-owl-bot[bot]'}},
      ]),
      listCommitsOnAPR('testRepoOwner', 'testRepoName', [
        {author: {login: 'gcf-owl-bot[bot]'}},
      ]),
    ];

    assert.deepStrictEqual(await owlBotTemplateChanges.checkPR(), true);
    scopes.forEach(scope => scope.done());
  });
});
