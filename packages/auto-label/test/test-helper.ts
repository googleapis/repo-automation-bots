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

import {resolve} from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import {getLabelFromPathConfig} from '../src/helper';
import * as assert from 'assert';

const fixturesPath = resolve(__dirname, '../../test/fixtures');
export function loadConfig(configFile: string) {
  return yaml.load(
    fs.readFileSync(resolve(fixturesPath, 'config', configFile), 'utf-8')
  );
}

describe('getLabelFromPathConfig', () => {
  it('matches the earliest element in the path when multiple match', () => {
    const label = getLabelFromPathConfig('/composer/workflows', {
      composer: 'composer',
      workflows: 'workflows',
    });
    assert.strictEqual(label, 'composer');
  });

  it('matches deep element in path', () => {
    const label = getLabelFromPathConfig('/a/b/c/d/composer/workflows', {
      composer: 'composer',
      workflows: 'workflows',
    });
    assert.strictEqual(label, 'composer');
  });

  it('matches one element in path', () => {
    const label = getLabelFromPathConfig('/a/b/c/d/workflows', {
      composer: 'composer',
      workflows: 'workflows',
    });
    assert.strictEqual(label, 'workflows');
  });

  it('it returns empty when nothing matches', () => {
    const label = getLabelFromPathConfig('/composer/workflows', {});
    assert.strictEqual(label, '');
  });
});
