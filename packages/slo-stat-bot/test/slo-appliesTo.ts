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
import * as sloLogic from '../src/slo-logic';
import sinon from 'sinon';

const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('isValidType', () => {
  it('returns true if type is issue and issue is undefined', async () => {
    const isValid = await sloLogic.isValidType(undefined, false, 'issue');
    assert.strictEqual(isValid, true);
  });
  it('returns true if type is pr and prs is true', async () => {
    const isValid = await sloLogic.isValidType(true, true, 'pull_request');
    assert.strictEqual(isValid, true);
  });
  it('returns true if type is issue and issue is true', async () => {
    const isValid = await sloLogic.isValidType(true, false, 'issue');
    assert.strictEqual(isValid, true);
  });
  it('returns false if type is pr and prs is undefined', async () => {
    const isValid = await sloLogic.isValidType(true, undefined, 'pull_request');
    assert.strictEqual(isValid, false);
  });
  it('returns false if type is pr and prs is false', async () => {
    const isValid = await sloLogic.isValidType(true, false, 'pull_request');
    assert.strictEqual(isValid, false);
  });
  it('returns false if type is issue and issue is false', async () => {
    const isValid = await sloLogic.isValidType(false, true, 'issue');
    assert.strictEqual(isValid, false);
  });
});
describe('isValidGithubLabel', () => {
  it('returns true if excluded github labels is undefined', async () => {
    const isValid = await sloLogic.isValidGithubLabels(
      ['p3', 'bot: updates', 'bug'],
      undefined
    );
    assert.strictEqual(isValid, true);
  });
  it('returns true if github labels is a subset of issue labels', async () => {
    const isValid = await sloLogic.isValidGithubLabels(
      ['enhancement', 'bug', 'p1'],
      ['bug', 'p1']
    );
    assert.strictEqual(isValid, true);
  });
  it('returns true if github labels is empty', async () => {
    const isValid = await sloLogic.isValidGithubLabels(['bug', 'p3'], []);
    assert.strictEqual(isValid, true);
  });
  it('returns false if github labels is not a subset of issue labels', async () => {
    const isValid = await sloLogic.isValidGithubLabels(
      ['enhancement', 'bug', 'p1'],
      ['bug', 'p3']
    );
    assert.strictEqual(isValid, false);
  });
});
describe('isValidExcludedLabels', () => {
  it('returns true if excluded github labels is undefined', async () => {
    const isValid = await sloLogic.isValidExcludedLabels(
      ['p3', 'bot: updates', 'bug'],
      undefined
    );
    assert.strictEqual(isValid, true);
  });
  it('returns true if excluded github labels is not in issue labels', async () => {
    const isValid = await sloLogic.isValidExcludedLabels(
      ['enhancement', 'bug', 'p1'],
      ['p3', 'bot: updates']
    );
    assert.strictEqual(isValid, true);
  });
  it('returns true if excluded github labels is empty', async () => {
    const isValid = await sloLogic.isValidGithubLabels(['bug', 'p3'], []);
    assert.strictEqual(isValid, true);
  });
  it('returns false if excluded github labels is in github labels', async () => {
    const isValid = await sloLogic.isValidExcludedLabels(
      ['enhancement', 'bug', 'p1'],
      ['p3', 'bot: updates', 'bug']
    );
    assert.strictEqual(isValid, false);
  });
});
describe('isValidRule', () => {
  it('returns true if priority is undefined', async () => {
    const isValid = await sloLogic.isValidRule(
      ['p3', 'bot: updates', 'bug'],
      undefined,
      'priority: '
    );
    assert.strictEqual(isValid, true);
  });
  it('returns true if the rule is present in issue label', async () => {
    const isValid = await sloLogic.isValidRule(
      ['p3', 'bot: updates', 'bug'],
      'p3',
      'priority: '
    );
    assert.strictEqual(isValid, true);
  });
  it('returns true if a string (title: rule) is present in issue label', async () => {
    const isValid = await sloLogic.isValidRule(
      ['priority: p3', 'bot: updates', 'bug'],
      'p3',
      'priority: '
    );
    assert.strictEqual(isValid, true);
  });
  it('returns true if rule is empty', async () => {
    const isValid = await sloLogic.isValidGithubLabels(
      ['bug', 'p3'],
      undefined
    );
    assert.strictEqual(isValid, true);
  });
  it('returns false if neither rule or title plus rule is present in issue labels', async () => {
    const isValid = await sloLogic.isValidRule(
      ['priority: p3', 'bot: updates', 'bug'],
      'enhancement',
      'type: '
    );
    assert.strictEqual(isValid, false);
  });
});
describe('doesSloApply', () => {
  let isValidTypeStub: sinon.SinonStub;
  let isValidGitLabelsStub: sinon.SinonStub;
  let isValidExLabelsStub: sinon.SinonStub;
  let isValidRuleStub: sinon.SinonStub;
  //eslint-disable-next-line @typescript-eslint/no-var-requires
  const slo = require(resolve(fixturesPath, 'events', 'slo.json'));

  beforeEach(() => {
    isValidTypeStub = sinon.stub(sloLogic, 'isValidType');
    isValidGitLabelsStub = sinon.stub(sloLogic, 'isValidGithubLabels');
    isValidExLabelsStub = sinon.stub(sloLogic, 'isValidExcludedLabels');
    isValidRuleStub = sinon.stub(sloLogic, 'isValidRule');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('returns false if issue is not applicable depending on if its pr or issue', async () => {
    isValidTypeStub.onCall(0).returns(false);
    const isValid = await sloLogic.doesSloApply(
      'pr',
      slo,
      ['bot:auto label', 'p0'],
      3
    );

    sinon.assert.calledOnce(isValidTypeStub);
    sinon.assert.calledOnce(isValidTypeStub);
    sinon.assert.notCalled(isValidGitLabelsStub);
    sinon.assert.notCalled(isValidExLabelsStub);
    sinon.assert.notCalled(isValidRuleStub);
    assert.strictEqual(isValid, false);
  });

  it('returns false if githubLables is not subset', async () => {
    isValidTypeStub.onCall(0).returns(true);
    isValidGitLabelsStub.onCall(0).returns(false);
    const isValid = await sloLogic.doesSloApply(
      'issue',
      slo,
      ['bot:auto label', 'p0'],
      3
    );

    sinon.assert.calledOnce(isValidTypeStub);
    sinon.assert.calledOnce(isValidGitLabelsStub);
    sinon.assert.notCalled(isValidExLabelsStub);
    sinon.assert.notCalled(isValidRuleStub);
    assert.strictEqual(isValid, false);
  });
  it('returns false if excluded labels is in issue', async () => {
    isValidTypeStub.onCall(0).returns(true);
    isValidGitLabelsStub.onCall(0).returns(true);
    isValidExLabelsStub.onCall(0).returns(false);
    const isValid = await sloLogic.doesSloApply(
      'issue',
      slo,
      ['bot:auto label', 'p0', 'bug'],
      3
    );

    sinon.assert.calledOnce(isValidTypeStub);
    sinon.assert.calledOnce(isValidGitLabelsStub);
    sinon.assert.calledOnce(isValidExLabelsStub);
    sinon.assert.notCalled(isValidRuleStub);
    assert.strictEqual(isValid, false);
  });
  it('returns false if priority is not in issue', async () => {
    isValidTypeStub.onCall(0).returns(true);
    isValidGitLabelsStub.onCall(0).returns(true);
    isValidExLabelsStub.onCall(0).returns(true);
    isValidRuleStub.onCall(0).returns(false);
    const isValid = await sloLogic.doesSloApply(
      'issue',
      slo,
      ['bot:auto label', 'p0', 'bug'],
      3
    );

    sinon.assert.calledOnce(isValidTypeStub);
    sinon.assert.calledOnce(isValidGitLabelsStub);
    sinon.assert.calledOnce(isValidExLabelsStub);
    sinon.assert.calledOnce(isValidRuleStub);
    assert.strictEqual(isValid, false);
  });
  it('returns false if issue type is not in slo', async () => {
    isValidTypeStub.onCall(0).returns(true);
    isValidGitLabelsStub.onCall(0).returns(true);
    isValidExLabelsStub.onCall(0).returns(true);
    isValidRuleStub.onCall(0).returns(true);
    isValidRuleStub.onCall(1).returns(false);
    const isValid = await sloLogic.doesSloApply(
      'issue',
      slo,
      ['bot:auto label', 'p0', 'bug'],
      3
    );

    sinon.assert.calledOnce(isValidTypeStub);
    sinon.assert.calledOnce(isValidGitLabelsStub);
    sinon.assert.calledOnce(isValidExLabelsStub);
    sinon.assert.calledTwice(isValidRuleStub);
    assert.strictEqual(isValid, false);
  });
  it('returns true if appliesTo has no rules', async () => {
    const isValid = await sloLogic.doesSloApply(
      'issue',
      {
        appliesTo: {},
        complianceSettings: {
          resolutionTime: 0,
          responseTime: 0,
          requiresAssignee: false,
        },
      },
      ['bot:auto label', 'p0'],
      3
    );

    sinon.assert.notCalled(isValidTypeStub);
    sinon.assert.notCalled(isValidGitLabelsStub);
    sinon.assert.notCalled(isValidExLabelsStub);
    sinon.assert.notCalled(isValidRuleStub);
    assert.strictEqual(isValid, true);
  });
  it('returns true if all properties are satisfied', async () => {
    isValidTypeStub.onCall(0).returns(true);
    isValidGitLabelsStub.onCall(0).returns(true);
    isValidExLabelsStub.onCall(0).returns(true);
    isValidRuleStub.onCall(0).returns(true);
    isValidRuleStub.onCall(1).returns(true);
    const isValid = await sloLogic.doesSloApply(
      'issue',
      slo,
      ['bot:auto label', 'p0', 'bug'],
      3
    );

    sinon.assert.calledOnce(isValidTypeStub);
    sinon.assert.calledOnce(isValidGitLabelsStub);
    sinon.assert.calledOnce(isValidExLabelsStub);
    sinon.assert.calledTwice(isValidRuleStub);
    assert.strictEqual(isValid, true);
  });
});
