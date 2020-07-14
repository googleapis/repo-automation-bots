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
import {GitHubAPI} from 'probot';
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
  })
  it('returns true if type is pr and prs is true', async() => {
    const isValid = await getSLOStatus.isValidIssue(true, true, 'pull_request');
    assert.strictEqual(isValid, true);
  })
  it('returns true if type is issue and issue is true', async() => {
    const isValid = await getSLOStatus.isValidIssue(true, false, 'issue');
    assert.strictEqual(isValid, true);
  })
  it('returns false if type is pr and prs is undefined', async () => {
    const isValid = await getSLOStatus.isValidIssue(true, undefined, 'pull_request');
    assert.strictEqual(isValid, false);
  })
  it('returns false if type is pr and prs is false', async() => {
    const isValid = await getSLOStatus.isValidIssue(true, false, 'pull_request');
    assert.strictEqual(isValid, false);
  })
  it('returns false if type is issue and issue is false', async() => {
    const isValid = await getSLOStatus.isValidIssue(false, true, 'issue');
    assert.strictEqual(isValid, false);
  })
})
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
  const slo = require(resolve(
    fixturesPath,
    'events',
    'slo.json'
  ));

  beforeEach(() => {
    isValidIssueStub = sinon.stub(getSLOStatus, 'isValidIssue')
    isValidGitLabelsStub = sinon.stub(getSLOStatus, 'isValidGithubLabels');
    isValidExLabelsStub = sinon.stub(getSLOStatus, 'isValidExcludedLabels');
    isValidRuleStub = sinon.stub(getSLOStatus, 'isValidRule');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('returns false if issue is not applicable depending on if its pr or issue', async() => {
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
  })

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
    const isValid = await getSLOStatus.doesSloApply('issue',slo, [
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
describe('durationTime', () => {
  describe('duration is in days', () => {
    it('returns true since time difference is within duration', async () => {
      const isInDuration = await getSLOStatus.isInDuration(
        '5d',
        '2020-07-22T03:04:47Z',
        '2020-07-27T03:04:46Z'
      );
      assert.strictEqual(isInDuration, true);
    });
    it('returns false since time difference is not within duration', async () => {
      const isInDuration = await getSLOStatus.isInDuration(
        '5d',
        '2020-07-22T03:04:47Z',
        '2020-07-28T07:04:48Z'
      );
      assert.strictEqual(isInDuration, false);
    });
  });
  describe('duration is in hours', () => {
    it('returns true since time difference is within duration', async () => {
      const isInDuration = await getSLOStatus.isInDuration(
        '4h',
        '2020-07-22T03:04:47Z',
        '2020-07-22T07:04:46Z'
      );
      assert.strictEqual(isInDuration, true);
    });
    it('returns false since time difference is not within duration', async () => {
      const isInDuration = await getSLOStatus.isInDuration(
        '4h',
        '2020-07-22T03:04:47Z',
        '2020-07-22T07:04:48Z'
      );
      assert.strictEqual(isInDuration, false);
    });
  });
  describe('duration is in minutes', () => {
    it('returns true since time difference is within duration', async () => {
      const isInDuration = await getSLOStatus.isInDuration(
        '4m',
        '2020-07-22T03:04:47Z',
        '2020-07-22T03:08:47Z'
      );
      assert.strictEqual(isInDuration, true);
    });
    it('returns false since time difference is not within duration', async () => {
      const isInDuration = await getSLOStatus.isInDuration(
        '4m',
        '2020-07-22T03:04:47Z',
        '2020-07-22T03:18:47Z'
      );
      assert.strictEqual(isInDuration, false);
    });
  });
  describe('duration is in seconds', () => {
    it('returns true since time difference is within duration', async () => {
      const isInDuration = await getSLOStatus.isInDuration(
        '520s',
        '2020-07-22T03:04:00Z',
        '2020-07-22T03:11:47Z'
      );
      assert.strictEqual(isInDuration, true);
    });
    it('returns false since time difference is not within duration', async () => {
      const isInDuration = await getSLOStatus.isInDuration(
        '520s',
        '2020-07-22T03:04:00Z',
        '2020-07-22T04:11:47Z'
      );
      assert.strictEqual(isInDuration, false);
    });
  });
  describe('duration is a number', () => {
    it('returns true since time difference is within duration', async () => {
      const isInDuration = await getSLOStatus.isInDuration(
        520,
        '2020-07-22T03:04:00Z',
        '2020-07-22T03:11:47Z'
      );
      assert.strictEqual(isInDuration, true);
    });
    it('returns false since time difference is not within duration', async () => {
      const isInDuration = await getSLOStatus.isInDuration(
        520,
        '2020-07-22T03:04:00Z',
        '2020-07-22T04:11:47Z'
      );
      assert.strictEqual(isInDuration, false);
    });
  });
});
describe('getContributers', () => {
  it('Contributer is write', async () => {
    const responders = await getSLOStatus.getContributers(
      'testOwner',
      new Set<string>(['coder-cat']),
      'WRITE',
      [
        {login: 'user1', permissions: {pull: true, push: true, admin: false}},
        {login: 'admin1', permissions: {pull: true, push: true, admin: true}},
      ]
    );
    assert.deepEqual(
      responders,
      new Set<string>(['coder-cat', 'user1', 'testOwner', 'admin1'])
    );
  });
  it('Contributer is admin', async () => {
    const responders = await getSLOStatus.getContributers(
      'testOwner',
      new Set<string>(),
      'ADMIN',
      [
        {login: 'user1', permissions: {pull: true, push: true, admin: false}},
        {login: 'admin1', permissions: {pull: true, push: true, admin: true}},
      ]
    );
    assert.deepEqual(
      responders,
      new Set<string>(['testOwner', 'admin1'])
    );
  });
  it('Contributer is owner', async () => {
    const responders = await getSLOStatus.getContributers(
      'testOwner',
      new Set<string>(['user2']),
      'OWNER',
      [
        {login: 'user1', permissions: {pull: true, push: true, admin: false}},
        {login: 'admin1', permissions: {pull: true, push: true, admin: true}},
      ]
    );
    assert.deepEqual(
      responders,
      new Set<string>(['testOwner', 'user2'])
    );
  });
});
describe('getResponders', () => {
  const githubAPI: GitHubAPI = GitHubAPI();
  let convertToArrayStub: sinon.SinonStub;
  let fileContentStub: sinon.SinonStub;
  let getCollaboratorStub: sinon.SinonStub;
  let getContributorsStub: sinon.SinonStub;

  beforeEach(() => {
    convertToArrayStub = sinon.stub(getSLOStatus, 'convertToArray');
    fileContentStub = sinon.stub(getSLOStatus, 'getFilePathContent');
    getCollaboratorStub = sinon.stub(getSLOStatus, 'getCollaborators');
    getContributorsStub = sinon.stub(getSLOStatus, 'getContributers');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('SLO does not have owners defined', async () => {
    const slo = {
      appliesTo: {
        issues: true,
        prs: false,
      },
      complianceSettings: {
        responseTime: 0,
        resolutionTime: 0,
        requiresAssignee: false,
        responders: {
          contributors: 'WRITE',
          users: ['user1', 'user2'],
        },
      },
    };
    getCollaboratorStub.onCall(0).returns([
      {login: 'user3', permissions: {pull: true, push: true, admin: false}},
      {
        login: 'customer2',
        permissions: {pull: false, push: false, admin: false},
      },
    ]);
    getContributorsStub.onCall(0).returns(
      new Set<string>(['user3', 'testOwner'])
    );
    const responders = await getSLOStatus.getResponders(
      githubAPI,
      'testOwner',
      'testRepo',
      slo
    );

    sinon.assert.notCalled(convertToArrayStub);
    sinon.assert.notCalled(fileContentStub);
    sinon.assert.calledOnce(getCollaboratorStub);
    sinon.assert.calledOnce(getContributorsStub);
    assert.deepEqual(
      responders,
      new Set<string>(['user1', 'user2', 'user3', 'testOwner'])
    );
  });
  it('SLO does not have contributers defined', async () => {
    const slo = {
      appliesTo: {
        issues: true,
        prs: false,
      },
      complianceSettings: {
        responseTime: 0,
        resolutionTime: 0,
        requiresAssignee: false,
        responders: {
          owners: ['.github/CODEOWNERS', 'collabs/owners.json'],
          users: ['user1', 'user2'],
        },
      },
    };
    convertToArrayStub
      .onCall(0)
      .returns(['.github/CODEOWNERS', 'collabs/owners.json']);
    fileContentStub.onCall(0).returns('@owner1  @owner2');
    fileContentStub.onCall(1).returns('@coder-cat @tester');
    const responders = await getSLOStatus.getResponders(
      githubAPI,
      'testOwner',
      'testRepo',
      slo
    );

    sinon.assert.calledOnce(convertToArrayStub);
    sinon.assert.calledTwice(fileContentStub);
    sinon.assert.notCalled(getCollaboratorStub);
    sinon.assert.notCalled(getContributorsStub);
    assert.deepEqual(
      responders,
      new Set<string>([
        'testOwner',
        'user1',
        'user2',
        'owner1',
        'owner2',
        'coder-cat',
        'tester',
      ])
    );
  });
  it('SLO does not have users defined', async () => {
    const slo = {
      appliesTo: {
        issues: true,
        prs: false,
      },
      complianceSettings: {
        responseTime: 0,
        resolutionTime: 0,
        requiresAssignee: false,
        responders: {
          owners: '.github/CODEOWNERS',
          contributors: 'ADMIN',
        },
      },
    };
    convertToArrayStub.onCall(0).returns(['.github/CODEOWNERS']);
    fileContentStub.onCall(0).returns('@owner1  @owner2');
    getCollaboratorStub
      .onCall(0)
      .returns([
        {login: 'admin1', permissions: {pull: true, push: true, admin: true}},
      ]);
    getContributorsStub.onCall(0).returns(
      new Set<string>(['owner1', 'owner2', 'admin1', 'testOwner'])
    );
    const responders = await getSLOStatus.getResponders(
      githubAPI,
      'testOwner',
      'testRepo',
      slo
    );

    sinon.assert.calledOnce(convertToArrayStub);
    sinon.assert.calledOnce(fileContentStub);
    sinon.assert.calledOnce(getCollaboratorStub);
    sinon.assert.calledOnce(getContributorsStub);
    assert.deepEqual(
      responders,
      new Set<string>(['owner1', 'owner2', 'admin1', 'testOwner'])
    );
  });
  it('SLO has all three: owners, contributers, and users defined', async () => {
    const slo = {
      appliesTo: {
        issues: true,
        prs: false,
      },
      complianceSettings: {
        responseTime: 0,
        resolutionTime: 0,
        requiresAssignee: false,
        responders: {
          owners: '.github/CODEOWNERS',
          contributors: 'WRITE',
          users: ['user1', 'user2', 'user3'],
        },
      },
    };
    convertToArrayStub.onCall(0).returns(['.github/CODEOWNERS']);
    fileContentStub.onCall(0).returns('@owner1  @owner2');
    getCollaboratorStub.onCall(0).returns([
      {login: 'collab1', permissions: {pull: true, push: true, admin: false}},
      {
        login: 'customer2',
        permissions: {pull: false, push: false, admin: false},
      },
    ]);
    getContributorsStub.onCall(0).returns(
      new Set<string>(['owner1', 'owner2', 'collab1', 'testOwner'])
    );
    const responders = await getSLOStatus.getResponders(
      githubAPI,
      'testOwner',
      'testRepo',
      slo
    );

    sinon.assert.calledOnce(convertToArrayStub);
    sinon.assert.calledOnce(fileContentStub);
    sinon.assert.calledOnce(getCollaboratorStub);
    sinon.assert.calledOnce(getContributorsStub);
    assert.deepEqual(
      responders,
      new Set<string>([
        'owner1',
        'owner2',
        'collab1',
        'testOwner',
        'user1',
        'user2',
        'user3',
      ])
    );
  });
});
describe('isAssigned', () => {
  it('return true if valid responder was assigned the issue', async () => {
    const isValid = await getSLOStatus.isAssigned(
      new Set<string>(['user1', 'testOwner', 'admin1']),
      [{login: 'random1'}, {login: 'user1'}]
    );
    assert.strictEqual(isValid, true);
  });
  it('return false if list of assignees was empty was empty', async () => {
    const isValid = await getSLOStatus.isAssigned(
      new Set<string>(['user1', 'testOwner', 'admin1']),
      []
    );
    assert.strictEqual(isValid, false);
  });
  it('return false if valid responder was not assigned the issue', async () => {
    const isValid = await getSLOStatus.isAssigned(
      new Set<string>(['testOwner']),
      [{login: 'user1'}, {login: 'admin1'}]
    );
    assert.strictEqual(isValid, false);
  });
});
describe('isInResponseTime', () => {
  let isInDurationStub: sinon.SinonStub;

  beforeEach(() => {
    isInDurationStub = sinon.stub(getSLOStatus, 'isInDuration');
  });

  afterEach(() => {
    sinon.restore();
  });
  it('returns true if there exists a valid responder comments and it is in duration', async () => {
    const issueComments = [
      {
        id: 5,
        user: {
          login: 'testOwner',
        },
        created_at: '2020-07-27T03:04:00Z',
        updated_at: '2020-07-27T03:04:00Z',
      },
      {
        id: 5,
        user: {
          login: 'user1',
        },
        created_at: '2020-07-23T03:04:00Z',
        updated_at: '2020-07-23T03:04:00Z',
      },
    ];
    isInDurationStub.onCall(0).returns(false);
    isInDurationStub.onCall(1).returns(true);
    const isValid = await getSLOStatus.isInResponseTime(
      new Set<string>(['testOwner', 'user1', 'admin1']),
      issueComments,
      '4d',
      '2020-07-22T03:04:00Z'
    );
    sinon.assert.calledTwice(isInDurationStub);
    assert.strictEqual(isValid, true);
  });
  it('returns false if a valid responder comments and it is not in duration', async () => {
    const issueComments = [
      {
        id: 5,
        user: {
          login: 'testOwner',
        },
        created_at: '2020-07-27T03:04:00Z',
        updated_at: '2020-07-27T03:04:00Z',
      },
    ];
    isInDurationStub.onCall(0).returns(false);
    const isValid = await getSLOStatus.isInResponseTime(
      new Set<string>(['testOwner', 'user1', 'admin1']),
      issueComments,
      '4d',
      '2020-07-22T03:04:00Z'
    );
    sinon.assert.calledOnce(isInDurationStub);
    assert.strictEqual(isValid, false);
  });
  it('returns false if a valid responder does not comment', async () => {
    const issueComments = [
      {
        id: 5,
        user: {
          login: 'customer1',
        },
        created_at: '2020-07-23T03:04:00Z',
        updated_at: '2020-07-23T03:04:00Z',
      },
    ];
    const isValid = await getSLOStatus.isInResponseTime(
      new Set<string>(['testOwner', 'user1', 'admin1']),
      issueComments,
      '4d',
      '2020-07-22T03:04:00Z'
    );
    sinon.assert.notCalled(isInDurationStub);
    assert.strictEqual(isValid, false);
  });
});
describe('isCompliant given slo applies to issue', () => {
  const githubAPI: GitHubAPI = GitHubAPI();
  let isInDurationStub: sinon.SinonStub;
  let getRespondersStub: sinon.SinonStub;
  let isAssignedStub: sinon.SinonStub;
  let getCommentsStub: sinon.SinonStub;
  let isInResponseStub: sinon.SinonStub;

  beforeEach(() => {
    isInDurationStub = sinon.stub(getSLOStatus, 'isInDuration');
    getRespondersStub = sinon.stub(getSLOStatus, 'getResponders');
    isAssignedStub = sinon.stub(getSLOStatus, 'isAssigned');
    getCommentsStub = sinon.stub(getSLOStatus, 'getIssueCommentsList');
    isInResponseStub = sinon.stub(getSLOStatus, 'isInResponseTime');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('returns false if issue is not resolved in resolution time', async () => {
    const slo = {
      appliesTo: {
        issues: true,
        prs: false,
      },
      complianceSettings: {
        resolutionTime: '3m',
        responseTime: 0,
        requiresAssignee: false,
        responders: {
          users: ['user1', 'user2', 'user3'],
        },
      },
    };

    isInDurationStub.onCall(0).returns(false);
    const isValid = await getSLOStatus.isCompliant(
      githubAPI,
      'testOwner',
      'testRepo',
      1,
      [{login: 'testOwner'}],
      '2020-07-22T03:04:00Z',
      slo
    );

    sinon.assert.calledOnce(isInDurationStub);
    sinon.assert.notCalled(getRespondersStub);
    sinon.assert.notCalled(isAssignedStub);
    sinon.assert.notCalled(getCommentsStub);
    sinon.assert.notCalled(isInResponseStub);
    assert.strictEqual(isValid, false);
  });
  it('returns false if issue is not assigned to responder', async () => {
    const slo = {
      appliesTo: {
        issues: true,
        prs: false,
      },
      complianceSettings: {
        resolutionTime: '7d',
        responseTime: 0,
        requiresAssignee: true,
        responders: {
          owners: '.github/CODEOWNERS',
        },
      },
    };

    isInDurationStub.onCall(0).returns(true);
    getRespondersStub.onCall(0).returns(
      new Set<string>(['testOwner', 'admin1', 'user1'])
    );
    isAssignedStub.onCall(0).returns(false);
    const isValid = await getSLOStatus.isCompliant(
      githubAPI,
      'testOwner',
      'testRepo',
      1,
      [{login: 'testOwner'}],
      '2020-07-22T03:04:00Z',
      slo
    );

    sinon.assert.calledOnce(isInDurationStub);
    sinon.assert.calledOnce(getRespondersStub);
    sinon.assert.calledOnce(isAssignedStub);
    sinon.assert.notCalled(getCommentsStub);
    sinon.assert.notCalled(isInResponseStub);
    assert.strictEqual(isValid, false);
  });
  it('returns false if issue is not in response time', async () => {
    const slo = {
      appliesTo: {
        issues: true,
        prs: false,
      },
      complianceSettings: {
        resolutionTime: '7d',
        responseTime: '60s',
        requiresAssignee: true,
        responders: {
          users: ['admin1', 'user1'],
        },
      },
    };

    isInDurationStub.onCall(0).returns(true);
    getRespondersStub.onCall(0).returns(
      new Set<string>(['testOwner', 'admin1', 'user1'])
    );
    isAssignedStub.onCall(0).returns(true);
    getCommentsStub.onCall(0).returns([]);
    isInResponseStub.onCall(0).returns(false);
    const isValid = await getSLOStatus.isCompliant(
      githubAPI,
      'testOwner',
      'testRepo',
      1,
      [{login: 'testOwner'}],
      '2020-07-22T03:04:00Z',
      slo
    );

    sinon.assert.calledOnce(isInDurationStub);
    sinon.assert.calledOnce(getRespondersStub);
    sinon.assert.calledOnce(isAssignedStub);
    sinon.assert.calledOnce(getCommentsStub);
    sinon.assert.calledOnce(isInResponseStub);
    assert.strictEqual(isValid, false);
  });
  it('returns true if issue is compliant and does not invoke isInDuration if resolution time is 0', async () => {
    const slo = {
      appliesTo: {
        issues: true,
        prs: false,
      },
      complianceSettings: {
        resolutionTime: 0,
        responseTime: '60h',
        requiresAssignee: true,
        responders: {
          owners: '.github/CODEOWNERS',
          contributors: 'ADMIN',
        },
      },
    };

    getRespondersStub.onCall(0).returns(
      new Set<string>(['testOwner', 'admin1', 'user1'])
    );
    isAssignedStub.onCall(0).returns(true);
    getCommentsStub.onCall(0).returns([
      {
        id: 1,
        user: {
          login: 'testOwner',
        },
        created_at: '2020-07-22T03:05:00Z',
        updated_at: '2020-07-22T03:05:00Z',
      },
    ]);
    isInResponseStub.onCall(0).returns(true);
    const isValid = await getSLOStatus.isCompliant(
      githubAPI,
      'testOwner',
      'testRepo',
      1,
      [{login: 'testOwner'}],
      '2020-07-22T03:04:00Z',
      slo
    );

    sinon.assert.notCalled(isInDurationStub);
    sinon.assert.calledOnce(getRespondersStub);
    sinon.assert.calledOnce(isAssignedStub);
    sinon.assert.calledOnce(getCommentsStub);
    sinon.assert.calledOnce(isInResponseStub);
    assert.strictEqual(isValid, true);
  });
  it('returns true if issue is compliant and does not invoke isAssigned if it is false', async () => {
    const slo = {
      appliesTo: {
        issues: true,
        prs: false,
      },
      complianceSettings: {
        resolutionTime: '24h',
        responseTime: '6h',
        requiresAssignee: false,
        responders: {
          users: ['user1', 'user2'],
        },
      },
    };
    isInDurationStub.onCall(0).returns(true);
    getRespondersStub.onCall(0).returns(
      new Set<string>(['testOwner', 'user1', 'user2'])
    );
    getCommentsStub.onCall(0).returns([
      {
        id: 1,
        user: {
          login: 'testOwner',
        },
        created_at: '2020-07-22T03:05:00Z',
        updated_at: '2020-07-22T03:05:00Z',
      },
    ]);
    isInResponseStub.onCall(0).returns(true);
    const isValid = await getSLOStatus.isCompliant(
      githubAPI,
      'testOwner',
      'testRepo',
      1,
      [{login: 'testOwner'}],
      '2020-07-22T03:04:00Z',
      slo
    );

    sinon.assert.calledOnce(isInDurationStub);
    sinon.assert.calledOnce(getRespondersStub);
    sinon.assert.notCalled(isAssignedStub);
    sinon.assert.calledOnce(getCommentsStub);
    sinon.assert.calledOnce(isInResponseStub);
    assert.strictEqual(isValid, true);
  });
  it('returns true if issue is compliant and does not invoke isInResponseTime if response time is 0', async () => {
    const slo = {
      appliesTo: {
        issues: true,
        prs: false,
      },
      complianceSettings: {
        resolutionTime: '24h',
        responseTime: 0,
        requiresAssignee: true,
        responders: {
          users: ['user1', 'user2'],
        },
      },
    };
    isInDurationStub.onCall(0).returns(true);
    getRespondersStub.onCall(0).returns(
      new Set<string>(['testOwner', 'user1', 'user2'])
    );
    isAssignedStub.onCall(0).returns(true);
    const isValid = await getSLOStatus.isCompliant(
      githubAPI,
      'testOwner',
      'testRepo',
      1,
      [{login: 'testOwner'}],
      '2020-07-22T03:04:00Z',
      slo
    );

    sinon.assert.calledOnce(isInDurationStub);
    sinon.assert.calledOnce(getRespondersStub);
    sinon.assert.calledOnce(isAssignedStub);
    sinon.assert.notCalled(getCommentsStub);
    sinon.assert.notCalled(isInResponseStub);
    assert.strictEqual(isValid, true);
  });
});
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
