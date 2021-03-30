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

import nock from 'nock';
import {describe, it} from 'mocha';
import * as exp from '../src/export';
import * as assert from 'assert';

nock.disableNetConnect();

describe('export', () => {
  it('should export a result to bigquery', () => {
    // TODO: write a more meaningful test here.
    assert.ok(exp.exportToBigQuery);
  });
});
