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

import * as assert from 'assert';
// eslint-disable-next-line node/no-extraneous-import
import {ProbotOctokit} from 'probot';
import {describe, it, beforeEach, afterEach} from 'mocha';
import {IssuesListCommentsItem} from '../src/types';
import * as sloCompliant from '../src/slo-compliant';
import sinon from 'sinon';

function getIssueItem(comment?: IssuesListCommentsItem) {
  return {
    owner: 'testOwner',
    repo: 'testRepo',
    number: 3,
    type: 'issue',
    createdAt: '2020-07-22T03:04:00Z',
    assignees: [{login: 'testOwner', type: '', site_admin: false}],
    labels: [],
    comment: comment,
  };
}

describe('durationTime', () => {
  describe('duration is in days', () => {
    it('returns true since time difference is within duration', async () => {
      const isInDuration = await sloCompliant.isInDuration(
        '5d',
        '2020-07-22T03:04:47Z',
        '2020-07-27T03:04:46Z'
      );
      assert.strictEqual(isInDuration, true);
    });
    it('returns false since time difference is not within duration', async () => {
      const isInDuration = await sloCompliant.isInDuration(
        '5d',
        '2020-07-22T03:04:47Z',
        '2020-07-28T07:04:48Z'
      );
      assert.strictEqual(isInDuration, false);
    });
  });
  describe('duration is in hours', () => {
    it('returns true since time difference is within duration', async () => {
      const isInDuration = await sloCompliant.isInDuration(
        '4h',
        '2020-07-22T03:04:47Z',
        '2020-07-22T07:04:46Z'
      );
      assert.strictEqual(isInDuration, true);
    });
    it('returns false since time difference is not within duration', async () => {
      const isInDuration = await sloCompliant.isInDuration(
        '4h',
        '2020-07-22T03:04:47Z',
        '2020-07-22T07:04:48Z'
      );
      assert.strictEqual(isInDuration, false);
    });
  });
  describe('duration is in minutes', () => {
    it('returns true since time difference is within duration', async () => {
      const isInDuration = await sloCompliant.isInDuration(
        '4m',
        '2020-07-22T03:04:47Z',
        '2020-07-22T03:08:47Z'
      );
      assert.strictEqual(isInDuration, true);
    });
    it('returns false since time difference is not within duration', async () => {
      const isInDuration = await sloCompliant.isInDuration(
        '4m',
        '2020-07-22T03:04:47Z',
        '2020-07-22T03:18:47Z'
      );
      assert.strictEqual(isInDuration, false);
    });
  });
  describe('duration is in seconds', () => {
    it('returns true since time difference is within duration', async () => {
      const isInDuration = await sloCompliant.isInDuration(
        '520s',
        '2020-07-22T03:04:00Z',
        '2020-07-22T03:11:47Z'
      );
      assert.strictEqual(isInDuration, true);
    });
    it('returns false since time difference is not within duration', async () => {
      const isInDuration = await sloCompliant.isInDuration(
        '520s',
        '2020-07-22T03:04:00Z',
        '2020-07-22T04:11:47Z'
      );
      assert.strictEqual(isInDuration, false);
    });
  });
  describe('duration is a number', () => {
    it('returns true since time difference is within duration', async () => {
      const isInDuration = await sloCompliant.isInDuration(
        520,
        '2020-07-22T03:04:00Z',
        '2020-07-22T03:11:47Z'
      );
      assert.strictEqual(isInDuration, true);
    });
    it('returns false since time difference is not within duration', async () => {
      const isInDuration = await sloCompliant.isInDuration(
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
    const responders = await sloCompliant.getContributers(
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
    const responders = await sloCompliant.getContributers(
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
    const responders = await sloCompliant.getContributers(
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
  const githubAPI: InstanceType<typeof ProbotOctokit> = new ProbotOctokit();
  let fileContentStub: sinon.SinonStub;
  let getCollaboratorStub: sinon.SinonStub;
  let getContributorsStub: sinon.SinonStub;

  beforeEach(() => {
    fileContentStub = sinon.stub(sloCompliant, 'getFilePathContent');
    getCollaboratorStub = sinon.stub(sloCompliant, 'getCollaborators');
    getContributorsStub = sinon.stub(sloCompliant, 'getContributers');
  });

  afterEach(() => {
    sinon.restore();
  });
  it('SLO does not have responders defined, then defaults to write contributer', async () => {
    const slo = {
      appliesTo: {
        issues: true,
        prs: false,
      },
      complianceSettings: {
        responseTime: 0,
        resolutionTime: 0,
        requiresAssignee: false,
      },
    };
    getCollaboratorStub
      .onCall(0)
      .returns([
        {login: 'user3', permissions: {pull: true, push: true, admin: false}},
      ]);
    getContributorsStub.onCall(0).returns(
      new Set<string>(['user3', 'testOwner'])
    );
    const responders = await sloCompliant.getResponders(
      githubAPI,
      'testOwner',
      'testRepo',
      slo
    );

    sinon.assert.notCalled(fileContentStub);
    sinon.assert.calledOnce(getCollaboratorStub);
    sinon.assert.calledOnce(getContributorsStub);
    assert.deepEqual(
      responders,
      new Set<string>(['testOwner', 'user3'])
    );
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
    const responders = await sloCompliant.getResponders(
      githubAPI,
      'testOwner',
      'testRepo',
      slo
    );

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
    fileContentStub.onCall(0).returns('@owner1  @owner2');
    fileContentStub.onCall(1).returns('@coder-cat @tester');

    getContributorsStub.onCall(0).returns(
      new Set<string>(['owner1', 'owner2', 'coder-cat', 'tester', 'testOwner'])
    );
    const responders = await sloCompliant.getResponders(
      githubAPI,
      'testOwner',
      'testRepo',
      slo
    );

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

    fileContentStub.onCall(0).returns('@owner1  @owner2');
    getCollaboratorStub
      .onCall(0)
      .returns([
        {login: 'admin1', permissions: {pull: true, push: true, admin: true}},
      ]);
    getContributorsStub.onCall(0).returns(
      new Set<string>(['owner1', 'owner2', 'admin1', 'testOwner'])
    );
    const responders = await sloCompliant.getResponders(
      githubAPI,
      'testOwner',
      'testRepo',
      slo
    );

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
    const responders = await sloCompliant.getResponders(
      githubAPI,
      'testOwner',
      'testRepo',
      slo
    );

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
    const isValid = await sloCompliant.isAssigned(
      new Set<string>(['user1', 'testOwner', 'admin1']),
      [{login: 'random1'}, {login: 'user1'}]
    );
    assert.strictEqual(isValid, true);
  });
  it('return false if list of assignees was empty was empty', async () => {
    const isValid = await sloCompliant.isAssigned(
      new Set<string>(['user1', 'testOwner', 'admin1']),
      []
    );
    assert.strictEqual(isValid, false);
  });
  it('return false if valid responder was not assigned the issue', async () => {
    const isValid = await sloCompliant.isAssigned(
      new Set<string>(['testOwner']),
      [{login: 'user1'}, {login: 'admin1'}]
    );
    assert.strictEqual(isValid, false);
  });
});
describe('isInResponseTime', () => {
  const github = new ProbotOctokit();
  let isInDurationStub: sinon.SinonStub;
  let getIssueCommentsStub: sinon.SinonStub;

  beforeEach(() => {
    isInDurationStub = sinon.stub(sloCompliant, 'isInDuration');
    getIssueCommentsStub = sinon.stub(sloCompliant, 'getIssueCommentsList');
  });

  afterEach(() => {
    sinon.restore();
  });
  describe('issue_comment created with comment', () => {
    it('returns true if comment is not undefined and from a valid responder', async () => {
      const issueItem = getIssueItem({
        id: 3,
        user: {login: 'user1'},
        created_at: '',
        updated_at: '',
      });
      const isValid = await sloCompliant.isInResponseTime(
        github,
        issueItem,
        new Set<string>(['testOwner', 'user1', 'admin1']),
        '4d'
      );
      sinon.assert.notCalled(getIssueCommentsStub);
      assert.strictEqual(isValid, true);
    });
    it('if comment is not undefined and not from a valid responder it gets list of commenters to check for valid responnder', async () => {
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
      const issueItem = getIssueItem({
        id: 3,
        user: {login: 'invalid_user'},
        created_at: '',
        updated_at: '',
      });
      isInDurationStub.onCall(0).returns(false);
      getIssueCommentsStub.onCall(0).returns(issueComments);
      const isValid = await sloCompliant.isInResponseTime(
        github,
        issueItem,
        new Set<string>(['testOwner', 'user1', 'admin1']),
        '4d'
      );
      sinon.assert.calledOnce(isInDurationStub);
      sinon.assert.calledOnce(getIssueCommentsStub);
      assert.strictEqual(isValid, true);
    });
  });
  describe('issues with no comment', () => {
    it('returns true if issue is within response time', async () => {
      isInDurationStub.onCall(0).returns(true);
      const issueItem = getIssueItem({
        id: 3,
        user: {login: 'invalid_user'},
        created_at: '',
        updated_at: '',
      });
      const isValid = await sloCompliant.isInResponseTime(
        github,
        issueItem,
        new Set<string>(['testOwner', 'user1', 'admin1']),
        '4d'
      );

      sinon.assert.calledOnce(isInDurationStub);
      sinon.assert.notCalled(getIssueCommentsStub);
      assert.strictEqual(isValid, true);
    });
    it('returns true if it is not in response time but a valid responder commented', async () => {
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
      getIssueCommentsStub.onCall(0).returns(issueComments);

      const issueItem = getIssueItem({
        id: 3,
        user: {login: 'invalid_user'},
        created_at: '',
        updated_at: '',
      });
      const isValid = await sloCompliant.isInResponseTime(
        github,
        issueItem,
        new Set<string>(['testOwner', 'user1', 'admin1']),
        '4d'
      );
      sinon.assert.calledOnce(isInDurationStub);
      sinon.assert.calledOnce(getIssueCommentsStub);
      assert.strictEqual(isValid, true);
    });
    it('returns false if issue is not in response time and no valid responder commented', async () => {
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
      getIssueCommentsStub.onCall(0).returns(issueComments);

      const issueItem = getIssueItem({
        id: 3,
        user: {login: 'invalid_user'},
        created_at: '',
        updated_at: '',
      });
      const isValid = await sloCompliant.isInResponseTime(
        github,
        issueItem,
        new Set<string>(['user1', 'admin1']),
        '4d'
      );
      sinon.assert.calledOnce(isInDurationStub);
      sinon.assert.calledOnce(getIssueCommentsStub);
      assert.strictEqual(isValid, false);
    });
  });
});
describe('isCompliant given slo applies to issue', () => {
  const githubAPI: InstanceType<typeof ProbotOctokit> = new ProbotOctokit();
  const issueItem = {
    owner: 'testOwner',
    repo: 'testRepo',
    number: 1,
    type: 'issue',
    createdAt: '2020-07-22T03:04:00Z',
    assignees: [{login: 'testOwner', type: '', site_admin: false}],
    labels: [],
  };
  let isInDurationStub: sinon.SinonStub;
  let getRespondersStub: sinon.SinonStub;
  let isAssignedStub: sinon.SinonStub;
  let isInResponseStub: sinon.SinonStub;

  beforeEach(() => {
    isInDurationStub = sinon.stub(sloCompliant, 'isInDuration');
    getRespondersStub = sinon.stub(sloCompliant, 'getResponders');
    isAssignedStub = sinon.stub(sloCompliant, 'isAssigned');
    isInResponseStub = sinon.stub(sloCompliant, 'isInResponseTime');
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
    const isValid = await sloCompliant.isIssueCompliant(
      githubAPI,
      issueItem,
      slo
    );

    sinon.assert.calledOnce(isInDurationStub);
    sinon.assert.notCalled(getRespondersStub);
    sinon.assert.notCalled(isAssignedStub);
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
    const isValid = await sloCompliant.isIssueCompliant(
      githubAPI,
      issueItem,
      slo
    );

    sinon.assert.calledOnce(isInDurationStub);
    sinon.assert.calledOnce(getRespondersStub);
    sinon.assert.calledOnce(isAssignedStub);
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
    isInResponseStub.onCall(0).returns(false);
    const isValid = await sloCompliant.isIssueCompliant(
      githubAPI,
      issueItem,
      slo
    );

    sinon.assert.calledOnce(isInDurationStub);
    sinon.assert.calledOnce(getRespondersStub);
    sinon.assert.calledOnce(isAssignedStub);
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
    isInResponseStub.onCall(0).returns(true);
    const isValid = await sloCompliant.isIssueCompliant(
      githubAPI,
      issueItem,
      slo
    );

    sinon.assert.notCalled(isInDurationStub);
    sinon.assert.calledOnce(getRespondersStub);
    sinon.assert.calledOnce(isAssignedStub);
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
    isInResponseStub.onCall(0).returns(true);
    const isValid = await sloCompliant.isIssueCompliant(
      githubAPI,
      issueItem,
      slo
    );

    sinon.assert.calledOnce(isInDurationStub);
    sinon.assert.calledOnce(getRespondersStub);
    sinon.assert.notCalled(isAssignedStub);
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
    const isValid = await sloCompliant.isIssueCompliant(
      githubAPI,
      issueItem,
      slo
    );

    sinon.assert.calledOnce(isInDurationStub);
    sinon.assert.calledOnce(getRespondersStub);
    sinon.assert.calledOnce(isAssignedStub);
    sinon.assert.notCalled(isInResponseStub);
    assert.strictEqual(isValid, true);
  });
});
