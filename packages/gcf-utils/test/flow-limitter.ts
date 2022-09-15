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
import assert from 'assert';
import * as sinon from 'sinon';

import {FlowLimitter} from '../src/flow-limitter';

describe('FlowLimitter', () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  it('delays after batch is filled', () => {
    const limitter = new FlowLimitter(30, 30);
    for (let i = 0; i < 30; i++) {
      const delay = limitter.getDelay();
      assert(delay === 0);
    }
    // Then the next call should delay by 30 seconds
    // (at least 29 seconds);
    const delay = limitter.getDelay();
    assert(delay >= 29);
  });

  it('reset the item number after delay has passed', () => {
    const limitter = new FlowLimitter(30, 30);
    for (let i = 0; i < 29; i++) {
      const delay = limitter.getDelay();
      assert(delay === 0);
    }
    const now = new Date().getTime();
    const getTimeStub = sandbox.stub(Date.prototype, 'getTime');
    // Simulate 31 seconds later
    getTimeStub.returns(now + 31000);
    // Then the itemSent should be reset to 0, so
    // We'll get 0 for another full batch.
    for (let i = 0; i < 30; i++) {
      const delay = limitter.getDelay();
      assert(delay === 0);
    }
  });
});
