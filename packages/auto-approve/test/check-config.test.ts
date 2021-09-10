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

import {
  validateYaml,
  validateSchema,
  checkCodeOwners,
  checkAutoApprove,
} from '../src/check-config.js';
import {describe, it} from 'mocha';
import assert from 'assert';
import * as fs from 'fs';
import nock from 'nock';
import snapshot from 'snap-shot-it';
const {Octokit} = require('@octokit/rest');

const octokit = new Octokit({
  auth: 'mypersonalaccesstoken123',
});
const CONFIGURATION_FILE_PATH = 'auto-approve.yml';

nock.disableNetConnect();

function getCodeOwnersFile(response: string | undefined, status: number) {
  return nock('https://api.github.com')
    .get('/repos/owner/repo/contents/.github%2FCODEOWNERS')
    .reply(
      status,
      response ? {content: Buffer.from(response).toString('base64')} : undefined
    );
}

function getAutoApproveFile(response: string | undefined, status: number) {
  return nock('https://api.github.com')
    .get('/repos/owner/repo/contents/.github%2Fauto-approve.yml')
    .reply(
      status,
      response ? {content: Buffer.from(response).toString('base64')} : undefined
    );
}

async function invalidateSchema(configNum: number) {
  return await validateSchema(
    fs.readFileSync(
      `./test/fixtures/config/invalid-schemas/invalid-schema${configNum}.yml`,
      'utf8'
    )
  );
}

describe('check for config', () => {
  describe('whether config is a valid YAML object', () => {
    it('should return error message if YAML is invalid', () => {
      const isYamlValid = validateYaml(
        fs.readFileSync(
          './test/fixtures/config/invalid-schemas/invalid-yaml-config.yml',
          'utf8'
        )
      );
      snapshot(isYamlValid);
    });

    it('should return true if YAML is valid', async () => {
      const isYamlValid = validateYaml(
        fs.readFileSync(
          './test/fixtures/config/valid-schemas/valid-schema1.yml',
          'utf8'
        )
      );
      assert.strictEqual(isYamlValid, '');
    });
  });

  describe('whether YAML file has valid schema', async () => {
    it('should fail if YAML has any other properties than the ones specified', async () => {
      //does not have any additional properties
      const isSchemaValid = await invalidateSchema(1);
      snapshot(isSchemaValid ? isSchemaValid : 'undefined');
    });

    it('should fail if title does not match first author', async () => {
      //title does not correspond to author
      const isSchemaValid = await invalidateSchema(2);
      snapshot(isSchemaValid ? isSchemaValid : 'undefined');
    });

    it('should fail if title does not match second author', async () => {
      //title does not correspond to author
      const isSchemaValid = await invalidateSchema(3);
      snapshot(isSchemaValid ? isSchemaValid : 'undefined');
    });

    it('should fail if title does not match third author', async () => {
      //title does not correspond to author
      const isSchemaValid = await invalidateSchema(4);
      snapshot(isSchemaValid ? isSchemaValid : 'undefined');
    });

    it('should fail if author is not allowed', async () => {
      //author is not allowed
      const isSchemaValid = await invalidateSchema(5);
      snapshot(isSchemaValid ? isSchemaValid : 'undefined');
    });

    it('should fail if it does not have title property', async () => {
      //missing 'title' property
      const isSchemaValid = await invalidateSchema(6);
      snapshot(isSchemaValid ? isSchemaValid : 'undefined');
    });

    it('should fail if config is empty', async () => {
      //empty array
      const isSchemaValid = await invalidateSchema(7);
      snapshot(isSchemaValid ? isSchemaValid : 'undefined');
    });

    it('should fail if there are duplicate items', async () => {
      //duplicate items
      const isSchemaValid = await invalidateSchema(8);
      snapshot(isSchemaValid ? isSchemaValid : 'undefined');
    });

    it('should return empty string if YAML has all of the possible valid options', async () => {
      const isSchemaValid = await validateSchema(
        fs.readFileSync(
          './test/fixtures/config/valid-schemas/valid-schema1.yml',
          'utf8'
        )
      );
      assert.strictEqual(isSchemaValid, '');
    });

    it('should return empty string if YAML has any one of the possible valid options', async () => {
      const isSchemaValid = await validateSchema(
        fs.readFileSync(
          './test/fixtures/config/valid-schemas/valid-schema2.yml',
          'utf8'
        )
      );
      assert.strictEqual(isSchemaValid, '');
    });

    it('should return empty string if YAML has some of the possible valid options', async () => {
      const isSchemaValid = await validateSchema(
        fs.readFileSync(
          './test/fixtures/config/valid-schemas/valid-schema3.yml',
          'utf8'
        )
      );
      assert.strictEqual(isSchemaValid, '');
    });
  });

  describe('codeowner file behavior', async () => {
    it('should ask to change CODEOWNERS, if CODEOWNERS file is not configured properly (and the CODEOWNERS is not in the PR)', async () => {
      const codeownersFileResponse = fs.readFileSync(
        './test/fixtures/config/invalid-codeowners/invalid-codeowners1',
        'utf8'
      );
      const scopes = getCodeOwnersFile(codeownersFileResponse, 200);
      const response = await checkCodeOwners(
        octokit,
        'owner',
        'repo',
        undefined
      );
      scopes.done();
      assert.strictEqual(
        response,
        `You must add this line to the CODEOWNERS file for auto-approve.yml to merge pull requests on this repo: .github/${CONFIGURATION_FILE_PATH}  @googleapis/github-automation/`
      );
    });

    it('should ask to change codeowners, if codeowners file does not contain proper owners for config path (and the CODEOWNERS is not in the PR)', async () => {
      const codeownersFileResponse = fs.readFileSync(
        './test/fixtures/config/invalid-codeowners/invalid-codeowners2',
        'utf8'
      );
      const scopes = getCodeOwnersFile(codeownersFileResponse, 200);
      const response = await checkCodeOwners(
        octokit,
        'owner',
        'repo',
        undefined
      );
      scopes.done();
      assert.strictEqual(
        response,
        `You must add this line to the CODEOWNERS file for auto-approve.yml to merge pull requests on this repo: .github/${CONFIGURATION_FILE_PATH}  @googleapis/github-automation/`
      );
    });

    it('should accept a well-configured CODEOWNERS file', async () => {
      const codeownersFileResponse = fs.readFileSync(
        './test/fixtures/config/valid-codeowners',
        'utf8'
      );
      const scopes = getCodeOwnersFile(codeownersFileResponse, 200);
      const response = await checkCodeOwners(
        octokit,
        'owner',
        'repo',
        undefined
      );
      scopes.done();
      assert.strictEqual(response, '');
    });

    it('should accept a well-configured CODEOWNERS file in PR', async () => {
      const response = await checkCodeOwners(
        octokit,
        'owner',
        'repo',
        fs.readFileSync('./test/fixtures/config/valid-codeowners', 'utf8')
      );
      assert.strictEqual(response, '');
    });

    it('should ask to create a codeowners file if it does not exist', async () => {
      const scopes = getCodeOwnersFile(undefined, 403);
      const response = await checkCodeOwners(
        octokit,
        'owner',
        'repo',
        undefined
      );
      scopes.done();
      assert.strictEqual(
        response,
        `You must create a CODEOWNERS file for the configuration file for auto-approve.yml that lives in .github/CODEWONERS in your repository, and contains this line: .github/${CONFIGURATION_FILE_PATH}  @googleapis/github-automation/; please make sure it is accessible publicly.`
      );
    });

    it('should ask to change CODEOWNERS file in PR if it is not correctly formatted', async () => {
      const response = await checkCodeOwners(
        octokit,
        'owner',
        'repo',
        fs.readFileSync(
          './test/fixtures/config/invalid-codeowners/invalid-codeowners1',
          'utf8'
        )
      );
      assert.deepStrictEqual(
        response,
        `You must add this line to the CODEOWNERS file for auto-approve.yml to merge pull requests on this repo: .github/${CONFIGURATION_FILE_PATH}  @googleapis/github-automation/`
      );
    });
  });

  describe('auto-approve file behavior', async () => {
    it('should check if auto-approve is on main if it is undefined on PR', async () => {
      const autoapproveFileResponse = fs.readFileSync(
        './test/fixtures/config/valid-schemas/valid-schema1.yml',
        'utf8'
      );
      const scopes = getAutoApproveFile(autoapproveFileResponse, 200);
      const response = await checkAutoApprove(
        octokit,
        'owner',
        'repo',
        undefined
      );
      scopes.done();
      assert.strictEqual(response, '');
    });

    it('should return skip if autoapprove does not exist on PR or repo', async () => {
      const scopes = getAutoApproveFile(undefined, 404);
      const response = await checkAutoApprove(
        octokit,
        'owner',
        'repo',
        undefined
      );
      scopes.done();
      assert.strictEqual(response, 'Skip');
    });

    it('should return empty string if autoapprove is on PR, but has no issues', async () => {
      const autoapproveFileResponse = fs.readFileSync(
        './test/fixtures/config/valid-schemas/valid-schema1.yml',
        'utf8'
      );

      const response = await checkAutoApprove(
        octokit,
        'owner',
        'repo',
        autoapproveFileResponse
      );

      assert.strictEqual(response, '');
    });

    it('should return error messages if autoapprove is on PR and has issues', async () => {
      const autoapproveFileResponse = fs.readFileSync(
        './test/fixtures/config/invalid-schemas/invalid-schema1.yml',
        'utf8'
      );

      const response = await checkAutoApprove(
        octokit,
        'owner',
        'repo',
        autoapproveFileResponse
      );

      assert.notStrictEqual(response.length, 0);
    });

    it('should return error messages if autoapprove is on repo and has issues', async () => {
      const autoapproveFileResponse = fs.readFileSync(
        './test/fixtures/config/invalid-schemas/invalid-schema1.yml',
        'utf8'
      );

      const scopes = getAutoApproveFile(autoapproveFileResponse, 200);
      const response = await checkAutoApprove(
        octokit,
        'owner',
        'repo',
        undefined
      );
      scopes.done();
      assert.notStrictEqual(response.length, 0);
    });
  });
});
