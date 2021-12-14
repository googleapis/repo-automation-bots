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

import {
  owlBotYamlFromText,
  InvalidOwlBotConfigError,
} from '../src/config-files';
import {describe, it} from 'mocha';
import * as assert from 'assert';

describe('config-files', () => {
  it('parses a good yaml', async () => {
    const text = `
deep-copy-regex:
  - source: /google/cloud/vision
    dest: /src

deep-remove-regex:
  - /src

deep-preserve-regex:
  - /src/index.ts

begin-after-commit-hash: abc123

docker:
  image: gcr.io/cloud-devrel-resources/synthtool-nodejs:prod
`;
    const config = owlBotYamlFromText(text);
    assert.deepStrictEqual(config, {
      'deep-copy-regex': [{source: '/google/cloud/vision', dest: '/src'}],
      'deep-preserve-regex': ['/src/index.ts'],
      'deep-remove-regex': ['/src'],
      'begin-after-commit-hash': 'abc123',
      docker: {image: 'gcr.io/cloud-devrel-resources/synthtool-nodejs:prod'},
    });
  });

  it('parses squash', async () => {
    const text = `
squash: true
`;
    const config = owlBotYamlFromText(text);
    assert.deepStrictEqual(config, {
      squash: true,
    });
  });

  it('throws an exception when a required field is missing', async () => {
    const text = `
deep-copy-regex:
  - source: /google/cloud/vision

docker:
  image: gcr.io/cloud-devrel-resources/synthtool-nodejs:prod
`;
    assert.throws(
      () => owlBotYamlFromText(text),
      err => {
        assert.ok(err instanceof InvalidOwlBotConfigError);
        assert.strictEqual(err.errorMessages.length, 1);
        assert.strictEqual(
          err.errorMessages[0],
          "/deep-copy-regex/0 must have required property 'dest'"
        );
        return true;
      }
    );
  });
});
