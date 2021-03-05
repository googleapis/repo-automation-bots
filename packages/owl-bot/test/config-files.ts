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

import {owlBotYamlFromText} from '../src/config-files';
import {describe, it} from 'mocha';
import * as assert from 'assert';

describe('config-files', () => {
  it('parses a good yaml', async () => {
    const text = `
deep-copy-regex:
  - source: /google/cloud/vision
    dest: /src
    rm-dest: ''

docker:
  image: gcr.io/cloud-devrel-resources/synthtool-nodejs:prod
`;
    const config = owlBotYamlFromText(text);
    assert.deepStrictEqual(config, {
      'deep-copy-regex': [
        {source: '/google/cloud/vision', 'rm-dest': '', dest: '/src'},
      ],
      docker: {image: 'gcr.io/cloud-devrel-resources/synthtool-nodejs:prod'},
    });
  });

  it('throws an exception when a required field is missing', async () => {
    const text = `
deep-copy-regex:
  - source: /google/cloud/vision

docker:
  image: gcr.io/cloud-devrel-resources/synthtool-nodejs:prod
`;
    assert.throws(() => owlBotYamlFromText(text));
  });
});
