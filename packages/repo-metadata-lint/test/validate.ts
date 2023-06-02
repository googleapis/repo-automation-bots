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

import {describe, it, afterEach} from 'mocha';
import assert from 'assert';
import {Validate} from '../src/validate';
import * as StoreMetadata from '../src/store-metadata';
import {Octokit} from '@octokit/rest';
import {readFileSync} from 'fs';
import * as sinon from 'sinon';
import {RepositoryFileCache} from '@google-automations/git-file-utils';

const apiIndex = readFileSync('./test/fixtures/api-index-v1.json');
const sandbox = sinon.createSandbox();
const OctokitFactory = Octokit.defaults({
  retry: {enabled: false},
  throttle: {enabled: false},
});
const octokit = new OctokitFactory();

describe('validate', () => {
  beforeEach(() => {
    sandbox
      .stub(RepositoryFileCache.prototype, 'getFileContents')
      .withArgs('api-index-v1.json', 'master')
      .resolves({
        sha: 'abc123',
        content: '',
        mode: '100644',
        parsedContent: apiIndex.toString('utf-8'),
      });
  });
  afterEach(() => {
    sandbox.restore();
  });

  it('returns validation error for broken JSON', async () => {
    const corruptFile = '{';
    const validate = new Validate(octokit);
    const result = await validate.validate('.repo-metadata.json', corruptFile);
    assert.strictEqual(result.status, 'error');
    assert.strictEqual(result.errors[0], 'could not parse .repo-metadata.json');
  });

  it('returns validation error if api_shortname is not a known API', async () => {
    const file = JSON.stringify({
      api_shortname: 'zombocom',
      release_level: 'stable',
      library_type: 'GAPIC_AUTO',
      client_documentation: 'https://example.com',
    });
    const validate = new Validate(octokit);
    const result = await validate.validate(
      'apis/foo/.repo-metadata.json',
      file
    );
    assert.strictEqual(result.status, 'error');
    assert.strictEqual(
      result.errors[0],
      "api_shortname 'zombocom' invalid in apis/foo/.repo-metadata.json"
    );
  });

  it('succeeds if api_shortname missing, but library type does not correspond to API', async () => {
    const storeMetadataStub = sandbox.stub(StoreMetadata, 'storeMetadata');
    const file = JSON.stringify({
      name: 'bigquery',
      release_level: 'stable',
      library_type: 'OTHER',
      client_documentation: 'https://example.com',
    });
    const validate = new Validate(octokit);
    const result = await validate.validate(
      'apis/foo/.repo-metadata.json',
      file
    );
    assert.strictEqual(result.status, 'success');
    assert.strictEqual(result.errors.length, 0);
    sandbox.assert.calledOnce(storeMetadataStub);
  });

  it('returns validation error if library_type missing', async () => {
    const file = JSON.stringify({
      name: 'bigquery',
      api_shortname: 'bigquery',
      release_level: 'stable',
      client_documentation: 'https://example.com',
    });
    const validate = new Validate(octokit);
    const result = await validate.validate(
      'apis/foo/.repo-metadata.json',
      file
    );
    assert.strictEqual(result.status, 'error');
    assert.strictEqual(
      result.errors[0],
      "must have required property 'library_type' in apis/foo/.repo-metadata.json"
    );
  });

  it('returns validation error if library_type invalid', async () => {
    const file = JSON.stringify({
      name: 'bigquery',
      api_shortname: 'bigquery',
      release_level: 'stable',
      library_type: 'GAPIC_BLERG',
      client_documentation: 'https://example.com',
    });
    const validate = new Validate(octokit);
    const result = await validate.validate(
      'apis/foo/.repo-metadata.json',
      file
    );
    assert.strictEqual(result.status, 'error');
    assert.strictEqual(
      result.errors[0],
      'library_type must be equal to one of the allowed values in apis/foo/.repo-metadata.json'
    );
  });

  it('returns validation error if release_level not preview or stable', async () => {
    const file = JSON.stringify({
      name: 'bigquery',
      api_shortname: 'bigquery',
      release_level: 'ga',
      library_type: 'GAPIC_AUTO',
      client_documentation: 'https://example.com',
    });
    const validate = new Validate(octokit);
    const result = await validate.validate(
      'apis/foo/.repo-metadata.json',
      file
    );
    assert.strictEqual(result.status, 'error');
    assert.strictEqual(
      result.errors[0],
      'release_level must be equal to one of the allowed values in apis/foo/.repo-metadata.json'
    );
  });

  it('returns validation error if release_level missing', async () => {
    const file = JSON.stringify({
      name: 'bigquery',
      api_shortname: 'bigquery',
      library_type: 'GAPIC_AUTO',
      client_documentation: 'https://example.com',
    });
    const validate = new Validate(octokit);
    const result = await validate.validate(
      'apis/foo/.repo-metadata.json',
      file
    );
    assert.strictEqual(result.status, 'error');
    assert.strictEqual(
      result.errors[0],
      "must have required property 'release_level' in apis/foo/.repo-metadata.json"
    );
  });

  it('returns validation error if client_documentation missing', async () => {
    const file = JSON.stringify({
      name: 'bigquery',
      api_shortname: 'bigquery',
      library_type: 'GAPIC_AUTO',
      release_level: 'stable',
    });
    const validate = new Validate(octokit);
    const result = await validate.validate(
      'apis/foo/.repo-metadata.json',
      file
    );
    assert.strictEqual(result.status, 'error');
    assert.strictEqual(
      result.errors[0],
      "must have required property 'client_documentation' in apis/foo/.repo-metadata.json"
    );
  });

  it('returns validation error if client_documentation is invalid URL', async () => {
    const file = JSON.stringify({
      name: 'bigquery',
      api_shortname: 'bigquery',
      library_type: 'GAPIC_AUTO',
      release_level: 'stable',
      client_documentation: 'example',
    });
    const validate = new Validate(octokit);
    const result = await validate.validate(
      'apis/foo/.repo-metadata.json',
      file
    );
    assert.strictEqual(result.status, 'error');
    assert.strictEqual(
      result.errors[0],
      'client_documentation must match pattern "^https://.*" in apis/foo/.repo-metadata.json'
    );
  });

  it('succeeds when all fields are valid for GAPIC libraries', async () => {
    const storeMetadataStub = sandbox.stub(StoreMetadata, 'storeMetadata');
    const file = JSON.stringify({
      release_level: 'stable',
      library_type: 'GAPIC_AUTO',
      client_documentation: 'https://example.com',
      api_shortname: 'bigquery',
    });
    const validate = new Validate(octokit);
    const result = await validate.validate(
      'apis/foo/.repo-metadata.json',
      file
    );
    assert.strictEqual(result.status, 'success');
    sandbox.assert.calledOnce(storeMetadataStub);
  });

  it('succeeds for release_level of unreleased', async () => {
    const storeMetadataStub = sandbox.stub(StoreMetadata, 'storeMetadata');
    const file = JSON.stringify({
      release_level: 'unreleased',
      library_type: 'GAPIC_AUTO',
      client_documentation: 'https://example.com',
      api_shortname: 'bigquery',
    });
    const validate = new Validate(octokit);
    const result = await validate.validate(
      'apis/foo/.repo-metadata.json',
      file
    );
    assert.strictEqual(result.status, 'success');
    sandbox.assert.calledOnce(storeMetadataStub);
  });
});
