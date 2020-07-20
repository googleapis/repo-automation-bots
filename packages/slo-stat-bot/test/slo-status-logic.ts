// Copyright 2020 Google LLC
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

import * as assert from 'assert';
import {GitHubAPI} from 'probot/lib/github';
import {describe, it, beforeEach, afterEach} from 'mocha';
import * as sloLogic from '../src/slo-logic';
import sinon from 'sinon';

describe('sloLogic', () => {
  const githubAPI: GitHubAPI = GitHubAPI();
  const slo = {
    appliesTo: {},
    complianceSettings: {
      resolutionTime: 0,
      responseTime: '4d',
      requiresAssignee: false,
    },
  };
  let doesApplyStub: sinon.SinonStub;
  let isCompliantStub: sinon.SinonStub;

  beforeEach(() => {
    doesApplyStub = sinon.stub(sloLogic, 'doesSloApply');
    isCompliantStub = sinon.stub(sloLogic, 'isIssueCompliant');
  });

  afterEach(() => {
    sinon.restore();
  });
  it('returns appliesTo to be true and isCompliant to be false if issue applies to slo but not compliant', async () => {
    doesApplyStub.onCall(0).returns(true);
    isCompliantStub.onCall(0).returns(false);
    const result = await sloLogic.getSloStatus(
      githubAPI,
      'testOwner',
      'testRepo',
      '2020-07-22T03:04:00Z',
      [{login: 'coder-cat'}],
      3,
      'issue',
      slo,
      []
    );

    sinon.assert.calledOnce(doesApplyStub);
    sinon.assert.calledOnce(isCompliantStub);
    assert.deepEqual(result, {appliesTo: true, isCompliant: false});
  });
  it('returns appliesTo to be true if appliesTo has no rules and isCompliant to be true if it is compliant', async () => {
    doesApplyStub.onCall(0).returns(true);
    isCompliantStub.onCall(0).returns(true);
    const result = await sloLogic.getSloStatus(
      githubAPI,
      'testOwner',
      'testRepo',
      '2020-07-22T03:04:00Z',
      [{login: 'coder-cat'}],
      3,
      'issue',
      slo,
      []
    );

    sinon.assert.calledOnce(doesApplyStub);
    sinon.assert.calledOnce(isCompliantStub);
    assert.deepEqual(result, {appliesTo: true, isCompliant: true});
  });
  it('returns appliesTo to be false and isCompliant to be null if issue does not apply to slo', async () => {
    doesApplyStub.onCall(0).returns(false);
    const result = await sloLogic.getSloStatus(
      githubAPI,
      'testOwner',
      'testRepo',
      '2020-07-22T03:04:00Z',
      [{login: 'coder-cat'}],
      3,
      'issue',
      slo,
      []
    );

    sinon.assert.calledOnce(doesApplyStub);
    sinon.assert.notCalled(isCompliantStub);
    assert.deepEqual(result, {appliesTo: false, isCompliant: null});
  });
});
