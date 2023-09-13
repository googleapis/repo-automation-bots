// Copyright 2022 Google LLC
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

import {describe, it} from 'mocha';
import {validateConfig} from '@google-automations/bot-config-utils';
import {ConfigurationOptions} from '../src/config-constants';
import schema from '../src/config-schema.json';
import * as fs from 'fs';
import {resolve} from 'path';
import * as assert from 'assert';

const fixturesPath = resolve(__dirname, '../../test/fixtures');
function loadConfig(configFile: string) {
  return fs.readFileSync(resolve(fixturesPath, 'config', configFile), 'utf-8');
}

function assertValidConfig(config: string) {
  const configYaml = loadConfig(`${config}.yml`);
  const result = validateConfig<ConfigurationOptions>(configYaml, schema, {});
  assert.ok(result.isValid);
}

function assertInvalidConfig(config: string, errorPattern: RegExp) {
  const configYaml = loadConfig(`${config}.yml`);
  const result = validateConfig<ConfigurationOptions>(configYaml, schema, {});
  assert.ok(!result.isValid);
  assert.ok(result.errorText);
  assert.ok(result.errorText.match(errorPattern));
}

describe('config-schema', () => {
  it('validates a basic config', () => {
    assertValidConfig('valid');
  });
  it('validates extra files', () => {
    assertValidConfig('extra_files');
  });
  it('validates extra json files', () => {
    assertValidConfig('extra_files_json');
  });
  it('validates extra xml files', () => {
    assertValidConfig('extra_files_xml');
  });
  it('validates onDemand', () => {
    assertValidConfig('on_demand');
  });
  it('validates onDemand in a branch', () => {
    assertValidConfig('on_demand_branch');
  });
  it('rejects extra fields', () => {
    assertInvalidConfig('invalid', /must NOT have additional properties/);
  });
});
