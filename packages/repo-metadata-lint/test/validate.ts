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

// eslint-disable-next-line node/no-extraneous-import
import {describe, it} from 'mocha';
import assert from 'assert';
import {Validate} from '../src/validate';

describe('validate', () => {
  it('returns validation error for broken JSON', () => {
    const corruptFile = '{';
    const result = Validate.validate('.repo-metadata.json', corruptFile);
    assert.strictEqual(result.status, 'error');
    assert.strictEqual(result.errors[0], 'could not parse .repo-metadata.json');
  });

  it('returns validation error if api_shortname missing and library type corresponds to API', () => {
    const file = JSON.stringify({
      name: 'bigquery',
      release_level: 'stable',
      library_type: 'GAPIC_AUTO',
      client_documentation: 'https://example.com',
    });
    const result = Validate.validate('apis/foo/.repo-metadata.json', file);
    assert.strictEqual(result.status, 'error');
    assert.strictEqual(
      result.errors[0],
      'api_shortname field missing from apis/foo/.repo-metadata.json'
    );
  });

  it('succeeds if api_shortname missing, but library type does not correspond to API', () => {
    const file = JSON.stringify({
      name: 'bigquery',
      release_level: 'stable',
      library_type: 'OTHER',
      client_documentation: 'https://example.com',
    });
    const result = Validate.validate('apis/foo/.repo-metadata.json', file);
    assert.strictEqual(result.status, 'success');
    assert.strictEqual(result.errors.length, 0);
  });

  it('returns validation error if library_type missing', () => {
    const file = JSON.stringify({
      name: 'bigquery',
      api_shortname: 'bigquery',
      release_level: 'stable',
      client_documentation: 'https://example.com',
    });
    const result = Validate.validate('apis/foo/.repo-metadata.json', file);
    assert.strictEqual(result.status, 'error');
    assert.strictEqual(
      result.errors[0],
      "must have required property 'library_type' in apis/foo/.repo-metadata.json"
    );
  });

  it('returns validation error if library_type invalid', () => {
    const file = JSON.stringify({
      name: 'bigquery',
      api_shortname: 'bigquery',
      release_level: 'stable',
      library_type: 'GAPIC_BLERG',
      client_documentation: 'https://example.com',
    });
    const result = Validate.validate('apis/foo/.repo-metadata.json', file);
    assert.strictEqual(result.status, 'error');
    assert.strictEqual(
      result.errors[0],
      'library_type must be equal to one of the allowed values in apis/foo/.repo-metadata.json'
    );
  });

  it('returns validation error if release_level not preview or stable', () => {
    const file = JSON.stringify({
      name: 'bigquery',
      api_shortname: 'bigquery',
      release_level: 'ga',
      library_type: 'GAPIC_AUTO',
      client_documentation: 'https://example.com',
    });
    const result = Validate.validate('apis/foo/.repo-metadata.json', file);
    assert.strictEqual(result.status, 'error');
    assert.strictEqual(
      result.errors[0],
      'release_level must be equal to one of the allowed values in apis/foo/.repo-metadata.json'
    );
  });

  it('returns validation error if release_level missing', () => {
    const file = JSON.stringify({
      name: 'bigquery',
      api_shortname: 'bigquery',
      library_type: 'GAPIC_AUTO',
      client_documentation: 'https://example.com',
    });
    const result = Validate.validate('apis/foo/.repo-metadata.json', file);
    assert.strictEqual(result.status, 'error');
    assert.strictEqual(
      result.errors[0],
      "must have required property 'release_level' in apis/foo/.repo-metadata.json"
    );
  });

  it('returns validation error if client_documentation missing', () => {
    const file = JSON.stringify({
      name: 'bigquery',
      api_shortname: 'bigquery',
      library_type: 'GAPIC_AUTO',
      release_level: 'stable',
    });
    const result = Validate.validate('apis/foo/.repo-metadata.json', file);
    assert.strictEqual(result.status, 'error');
    assert.strictEqual(
      result.errors[0],
      "must have required property 'client_documentation' in apis/foo/.repo-metadata.json"
    );
  });

  it('returns validation error if client_documentation is invalid URL', () => {
    const file = JSON.stringify({
      name: 'bigquery',
      api_shortname: 'bigquery',
      library_type: 'GAPIC_AUTO',
      release_level: 'stable',
      client_documentation: 'example',
    });
    const result = Validate.validate('apis/foo/.repo-metadata.json', file);
    assert.strictEqual(result.status, 'error');
    assert.strictEqual(
      result.errors[0],
      'client_documentation must match pattern "^https://.*" in apis/foo/.repo-metadata.json'
    );
  });
});
