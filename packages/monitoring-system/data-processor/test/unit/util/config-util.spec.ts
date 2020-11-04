// Copyright 2020 Google LLC
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
//
import {describe, it} from 'mocha';
import assert from 'assert';
import {resolve} from 'path';
import {ConfigUtil} from '../../../src/util/config-util';

describe('ConfigUtil', () => {
  it('correctly reads a config file from a path', () => {
    const path = resolve('./test/unit/fixtures/sample-config.yml');
    const config = ConfigUtil.getConfig(path);
    assert.deepEqual(config, {
      task_queue_processor: {
        task_queue_project_id: 'foo-id',
        task_queue_location: 'bar-location',
      },
    });
  });
  it('throws an error if given path is invalid', () => {
    let threw = false;
    try {
      const path = resolve('some/invalid/path/to/config.yml');
      ConfigUtil.getConfig(path);
    } catch (e) {
      threw = true;
    } finally {
      assert(threw, 'Expected error to be thrown');
    }
  });
});
