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
//

import {resolve} from 'path';
import * as assert from 'assert';
import {describe, it, beforeEach, afterEach} from 'mocha';
import {getSLOStatus} from '../src/slo-logic';
import sinon from 'sinon';

const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('convertToArray', () => {
  it('converts a string to array', async () => {
    const labels = await getSLOStatus.convertToArray('bug');
    assert.strictEqual(typeof labels, 'object');
  });
  it('an array remains to stay an array', async () => {
    const labels = await getSLOStatus.convertToArray(['bug', 'p0']);
    assert.strictEqual(typeof labels, 'object');
  });
});
describe('isValidIssue', () => {
  it('returns true if type is issue and issue is undefined', async () => {
    const isValid = await getSLOStatus.isValidIssue(undefined, false, 'issue');
    assert.strictEqual(isValid, true);
  });
  it('returns true if type is pr and prs is true', async () => {
    const isValid = await getSLOStatus.isValidIssue(true, true, 'pull_request');
    assert.strictEqual(isValid, true);
  });
  it('returns true if type is issue and issue is true', async () => {
    const isValid = await getSLOStatus.isValidIssue(true, false, 'issue');
    assert.strictEqual(isValid, true);
  });
  it('returns false if type is pr and prs is undefined', async () => {
    const isValid = await getSLOStatus.isValidIssue(
      true,
      undefined,
      'pull_request'
    );
    assert.strictEqual(isValid, false);
  });
  it('returns false if type is pr and prs is false', async () => {
    const isValid = await getSLOStatus.isValidIssue(
      true,
      false,
      'pull_request'
    );
    assert.strictEqual(isValid, false);
  });
  it('returns false if type is issue and issue is false', async () => {
    const isValid = await getSLOStatus.isValidIssue(false, true, 'issue');
    assert.strictEqual(isValid, false);
  });
});
describe('isValidGithubLabel', () => {
  it('returns true if excluded github labels is undefined', async () => {
    const isValid = await getSLOStatus.isValidGithubLabels(
      ['p3', 'bot: updates', 'bug'],
      undefined
    );
    assert.strictEqual(isValid, true);
  });
  it('returns true if github labels is a subset of issue labels', async () => {
    const isValid = await getSLOStatus.isValidGithubLabels(
      ['enhancement', 'bug', 'p1'],
      ['bug', 'p1']
    );
    assert.strictEqual(isValid, true);
  });
  it('returns true if github labels is empty', async () => {
    const isValid = await getSLOStatus.isValidGithubLabels(['bug', 'p3'], []);
    assert.strictEqual(isValid, true);
  });
  it('returns false if github labels is not a subset of issue labels', async () => {
    const isValid = await getSLOStatus.isValidGithubLabels(
      ['enhancement', 'bug', 'p1'],
      ['bug', 'p3']
    );
    assert.strictEqual(isValid, false);
  });
});
describe('isValidExcludedLabels', () => {
  it('returns true if excluded github labels is undefined', async () => {
    const isValid = await getSLOStatus.isValidExcludedLabels(
      ['p3', 'bot: updates', 'bug'],
      undefined
    );
    assert.strictEqual(isValid, true);
  });
  it('returns true if excluded github labels is not in issue labels', async () => {
    const isValid = await getSLOStatus.isValidExcludedLabels(
      ['enhancement', 'bug', 'p1'],
      ['p3', 'bot: updates']
    );
    assert.strictEqual(isValid, true);
  });
  it('returns true if excluded github labels is empty', async () => {
    const isValid = await getSLOStatus.isValidGithubLabels(['bug', 'p3'], []);
    assert.strictEqual(isValid, true);
  });
  it('returns false if excluded github labels is in github labels', async () => {
    const isValid = await getSLOStatus.isValidExcludedLabels(
      ['enhancement', 'bug', 'p1'],
      ['p3', 'bot: updates', 'bug']
    );
    assert.strictEqual(isValid, false);
  });
});
describe('isValidRule', () => {
  it('returns true if priority is undefined', async () => {
    const isValid = await getSLOStatus.isValidRule(
      ['p3', 'bot: updates', 'bug'],
      undefined,
      'priority: '
    );
    assert.strictEqual(isValid, true);
  });
  it('returns true if the rule is present in issue label', async () => {
    const isValid = await getSLOStatus.isValidRule(
      ['p3', 'bot: updates', 'bug'],
      'p3',
      'priority: '
    );
    assert.strictEqual(isValid, true);
  });
  it('returns true if a string (title: rule) is present in issue label', async () => {
    const isValid = await getSLOStatus.isValidRule(
      ['priority: p3', 'bot: updates', 'bug'],
      'p3',
      'priority: '
    );
    assert.strictEqual(isValid, true);
  });
  it('returns true if rule is empty', async () => {
    const isValid = await getSLOStatus.isValidGithubLabels(
      ['bug', 'p3'],
      undefined
    );
    assert.strictEqual(isValid, true);
  });
  it('returns false if neither rule or title plus rule is present in issue labels', async () => {
    const isValid = await getSLOStatus.isValidRule(
      ['priority: p3', 'bot: updates', 'bug'],
      'enhancement',
      'type: '
    );
    assert.strictEqual(isValid, false);
  });
});
describe('doesSloApply', () => {
  let isValidIssueStub: sinon.SinonStub;
  let isValidGitLabelsStub: sinon.SinonStub;
  let isValidExLabelsStub: sinon.SinonStub;
  let isValidRuleStub: sinon.SinonStub;
  //eslint-disable-next-line @typescript-eslint/no-var-requires
  const slo = require(resolve(fixturesPath, 'events', 'slo.json'));

  beforeEach(() => {
    isValidIssueStub = sinon.stub(getSLOStatus, 'isValidIssue');
    isValidGitLabelsStub = sinon.stub(getSLOStatus, 'isValidGithubLabels');
    isValidExLabelsStub = sinon.stub(getSLOStatus, 'isValidExcludedLabels');
    isValidRuleStub = sinon.stub(getSLOStatus, 'isValidRule');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('returns false if issue is not applicable depending on if its pr or issue', async () => {
    isValidIssueStub.onCall(0).returns(false);
    const isValid = await getSLOStatus.doesSloApply('pr', slo, [
      'bot:auto label',
      'p0',
    ]);

    sinon.assert.calledOnce(isValidIssueStub);
    sinon.assert.calledOnce(isValidIssueStub);
    sinon.assert.notCalled(isValidGitLabelsStub);
    sinon.assert.notCalled(isValidExLabelsStub);
    sinon.assert.notCalled(isValidRuleStub);
    assert.strictEqual(isValid, false);
  });

  it('returns false if githubLables is not subset', async () => {
    isValidIssueStub.onCall(0).returns(true);
    isValidGitLabelsStub.onCall(0).returns(false);
    const isValid = await getSLOStatus.doesSloApply('issue', slo, [
      'bot:auto label',
      'p0',
    ]);

    sinon.assert.calledOnce(isValidIssueStub);
    sinon.assert.calledOnce(isValidGitLabelsStub);
    sinon.assert.notCalled(isValidExLabelsStub);
    sinon.assert.notCalled(isValidRuleStub);
    assert.strictEqual(isValid, false);
  });
  it('returns false if excluded labels is in issue', async () => {
    isValidIssueStub.onCall(0).returns(true);
    isValidGitLabelsStub.onCall(0).returns(true);
    isValidExLabelsStub.onCall(0).returns(false);
    const isValid = await getSLOStatus.doesSloApply('issue', slo, [
      'bot:auto label',
      'p0',
      'bug',
    ]);

    sinon.assert.calledOnce(isValidIssueStub);
    sinon.assert.calledOnce(isValidGitLabelsStub);
    sinon.assert.calledOnce(isValidExLabelsStub);
    sinon.assert.notCalled(isValidRuleStub);
    assert.strictEqual(isValid, false);
  });
  it('returns false if priority is not in issue', async () => {
    isValidIssueStub.onCall(0).returns(true);
    isValidGitLabelsStub.onCall(0).returns(true);
    isValidExLabelsStub.onCall(0).returns(true);
    isValidRuleStub.onCall(0).returns(false);
    const isValid = await getSLOStatus.doesSloApply('issue', slo, [
      'bot:auto label',
      'p0',
      'bug',
    ]);

    sinon.assert.calledOnce(isValidIssueStub);
    sinon.assert.calledOnce(isValidGitLabelsStub);
    sinon.assert.calledOnce(isValidExLabelsStub);
    sinon.assert.calledOnce(isValidRuleStub);
    assert.strictEqual(isValid, false);
  });
  it('returns false if issue type is not in slo', async () => {
    isValidIssueStub.onCall(0).returns(true);
    isValidGitLabelsStub.onCall(0).returns(true);
    isValidExLabelsStub.onCall(0).returns(true);
    isValidRuleStub.onCall(0).returns(true);
    isValidRuleStub.onCall(1).returns(false);
    const isValid = await getSLOStatus.doesSloApply('issue', slo, [
      'bot:auto label',
      'p0',
      'bug',
    ]);

    sinon.assert.calledOnce(isValidIssueStub);
    sinon.assert.calledOnce(isValidGitLabelsStub);
    sinon.assert.calledOnce(isValidExLabelsStub);
    sinon.assert.calledTwice(isValidRuleStub);
    assert.strictEqual(isValid, false);
  });
  it('returns true if appliesTo has no rules', async () => {
    const isValid = await getSLOStatus.doesSloApply(
      'issue',
      {
        appliesTo: {},
        complianceSettings: {
          resolutionTime: 0,
          responseTime: 0,
          requiresAssignee: false,
        },
      },
      ['bot:auto label', 'p0']
    );

    sinon.assert.notCalled(isValidIssueStub);
    sinon.assert.notCalled(isValidGitLabelsStub);
    sinon.assert.notCalled(isValidExLabelsStub);
    sinon.assert.notCalled(isValidRuleStub);
    assert.strictEqual(isValid, true);
  });
  it('returns true if all properties are satisfied', async () => {
    isValidIssueStub.onCall(0).returns(true);
    isValidGitLabelsStub.onCall(0).returns(true);
    isValidExLabelsStub.onCall(0).returns(true);
    isValidRuleStub.onCall(0).returns(true);
    isValidRuleStub.onCall(1).returns(true);
    const isValid = await getSLOStatus.doesSloApply('issue', slo, [
      'bot:auto label',
      'p0',
      'bug',
    ]);

    sinon.assert.calledOnce(isValidIssueStub);
    sinon.assert.calledOnce(isValidGitLabelsStub);
    sinon.assert.calledOnce(isValidExLabelsStub);
    sinon.assert.calledTwice(isValidRuleStub);
    assert.strictEqual(isValid, true);
  });
});
