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

import {owlBotYamlFrom} from '../src/config-files';
import {describe, it} from 'mocha';
import yaml from 'js-yaml';
import * as assert from 'assert';

describe('config-files', () => {
  it('parses a good yaml', async () => {
    const text = `
copy-dirs:
  - source: /google/cloud/vision
    dest: /src

docker:
  image: gcr.io/cloud-devrel-resources/synthtool-nodejs:prod
`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = owlBotYamlFrom(yaml.load(text) as Record<string, any>);
    assert.deepStrictEqual(config, {
      'copy-dirs': [{source: '/google/cloud/vision', dest: '/src'}],
      docker: {image: 'gcr.io/cloud-devrel-resources/synthtool-nodejs:prod'},
    });
  });

  it('throws an exception when a required field is missing', async () => {
    const text = `
copy-dirs:
  - source: /google/cloud/vision

docker:
  image: gcr.io/cloud-devrel-resources/synthtool-nodejs:prod
`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config = yaml.load(text) as Record<string, any>;
    assert.throws(() => owlBotYamlFrom(config));
  });
});
