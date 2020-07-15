import * as assert from 'assert';
import {GitHubAPI} from 'probot/lib/github';
import {describe, it, beforeEach, afterEach} from 'mocha';
import {getSLOStatus} from '../src/slo-logic';
import sinon from 'sinon';

describe('getSLOStatus', () => {
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
    doesApplyStub = sinon.stub(getSLOStatus, 'doesSloApply');
    isCompliantStub = sinon.stub(getSLOStatus, 'isCompliant');
  });

  afterEach(() => {
    sinon.restore();
  });
  it('returns appliesTo to be true and isCompliant to be false if issue applies to slo but not compliant', async () => {
    doesApplyStub.onCall(0).returns(true);
    isCompliantStub.onCall(0).returns(false);
    const result = await getSLOStatus(
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
    const result = await getSLOStatus(
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
    const result = await getSLOStatus(
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
