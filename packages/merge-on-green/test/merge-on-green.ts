/**
 * Copyright 2020 Google LLC. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

//import myProbotApp from '../src/merge-on-green';

import { resolve } from 'path';
import handler from '../src/merge-on-green';
import { Probot } from 'probot';
import nock from 'nock';
import * as fs from 'fs';
import { mergeOnGreen } from '../src/merge-logic';

interface WatchPR {
  number: number;
  repo: string;
  owner: string;
  state: 'continue' | 'stop';
  url: string;
}

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/Fixtures');

describe('merge-on-green', () => {
  let probot: Probot;

  beforeEach(() => {
    probot = new Probot({
      // use a bare instance of octokit, the default version
      // enables retries which makes testing difficult.
      Octokit: require('@octokit/rest'),
    });

    probot.app = {
      getSignedJsonWebToken() {
        return 'abc123';
      },
      getInstallationAccessToken(): Promise<string> {
        return Promise.resolve('abc123');
      },
    };
    probot.load(handler);
  });

  it('merges a PR on green', async () => {
    handler.listPRs = async () => {
      const watchPr: WatchPR[] = [
        {
          number: 1,
          repo: 'testRepo',
          owner: 'testOwner',
          state: 'continue',
          url: 'github.com/foo/bar'
        },
      ];
      return watchPr;
    };

    handler.removePR = async () => {
      return Promise.resolve(undefined);
    };

    mergeOnGreen.getMOGLabel = async () => {
      return true;
    };

    const requiredChecks = fs.readFileSync(
      resolve(fixturesPath, 'config', 'required_checks.json')
    );

    const map = fs.readFileSync(resolve(fixturesPath, 'config', 'map.json'));

    function requiredChecksByLanguage() {
      return nock('https://api.github.com')
        .log(console.log)
        .get('/repos/googleapis/sloth/contents/required-checks.json')
        .reply(200, { content: requiredChecks.toString('base64') });
    }

    function repoMap() {
      return nock('https://api.github.com')
        .log(console.log)
        .get('/repos/googleapis/sloth/contents/repos.json')
        .reply(200, { content: map.toString('base64') });
    }

    function getReviewsCompleted() {
      return nock('https://api.github.com')
        .log(console.log)
        .get('/repos/testOwner/testRepo/pulls/1/reviews')
        .reply(200, {
          user: {
            login: 'octocat',
          },
          state: 'APPROVED',
        });
    }

    function getReviewsRequested() {
      return nock('https://api.github.com')
        .log(console.log)
        .get('/repos/testOwner/testRepo/pulls/1/requested_reviewers')
        .reply(200, { users: [], teams: [] });
    }

    function getLatestCommit() {
      return nock('https://api.github.com')
        .log(console.log)
        .get('/repos/testOwner/testRepo/pulls/1/commits?per_page=100&page=1')
        .reply(200, [{ sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e' }]);
    }

    function getStatusi() {
      return nock('https://api.github.com')
        .log(console.log)
        .get(
          '/repos/testOwner/testRepo/commits/6dcb09b5b57875f334f61aebed695e2e4193db5e/statuses?per_page=100'
        )
        .reply(200, [
          {
            state: 'success',
            context: 'Kokoro - Test: Binary Compatibility',
          },
        ]);
    }

    const scopes = [
      getReviewsCompleted(),
      getReviewsRequested(),
      getLatestCommit(),
      getStatusi(),
      requiredChecksByLanguage(),
      repoMap(),
    ];

    await probot.receive({
      name: 'schedule.repository',
      payload: {},
      id: 'abc123',
    });

    scopes.forEach(s => s.done());
  });
});

/*
    it('merges a PR on green', async () => {
      handler.listPRs = async () => {
        const watchPr: WatchPR[] = [
          {
            number: 1,
            repo: 'testOwner',
            owner: 'testRepo',
            state: 'continue',
          },
        ];
        return watchPr;
      };

      handler.removePR = async () => {
        return Promise.resolve(undefined);
      };

      mergeOnGreen.getReviewsCompleted = async () => {
        return [
          {
            id: 80,
            node_id: 'MDE3OlB1bGxSZXF1ZXN0UmV2aWV3ODA=',
            user: {
              login: 'octocat',
              id: 1,
              node_id: 'MDQ6VXNlcjE=',
              avatar_url: 'https://github.com/images/error/octocat_happy.gif',
              gravatar_id: '',
              url: 'https://api.github.com/users/octocat',
              html_url: 'https://github.com/octocat',
              followers_url: 'https://api.github.com/users/octocat/followers',
              following_url:
                'https://api.github.com/users/octocat/following{/other_user}',
              gists_url: 'https://api.github.com/users/octocat/gists{/gist_id}',
              starred_url:
                'https://api.github.com/users/octocat/starred{/owner}{/repo}',
              subscriptions_url:
                'https://api.github.com/users/octocat/subscriptions',
              organizations_url: 'https://api.github.com/users/octocat/orgs',
              repos_url: 'https://api.github.com/users/octocat/repos',
              events_url:
                'https://api.github.com/users/octocat/events{/privacy}',
              received_events_url:
                'https://api.github.com/users/octocat/received_events',
              type: 'User',
              site_admin: false,
            },
            body: 'Here is the body for the review.',
            submitted_at: '2019-11-17T17:43:43Z',
            commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
            state: 'APPROVED',
            html_url:
              'https://github.com/testRepo/testOwnrt/pull/1#pullrequestreview-80',
            pull_request_url:
              'https://api.github.com/repos/octocat/Hello-World/pulls/12',
            _links: {
              html: {
                href:
                  'https://github.com/octocat/Hello-World/pull/12#pullrequestreview-80',
              },
              pull_request: {
                href:
                  'https://api.github.com/repos/octocat/Hello-World/pulls/12',
              },
            },
          },
        ];
      };

      mergeOnGreen.getReviewsRequested = async () => {
        return null;
      };

      mergeOnGreen.getLatestCommit = async () => {
        return [
          {
            url:
              'https://api.github.com/repos/octocat/Hello-World/commits/6dcb09b5b57875f334f61aebed695e2e4193db5e',
            sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
            node_id:
              'MDY6Q29tbWl0NmRjYjA5YjViNTc4NzVmMzM0ZjYxYWViZWQ2OTVlMmU0MTkzZGI1ZQ==',
            html_url:
              'https://github.com/octocat/Hello-World/commit/6dcb09b5b57875f334f61aebed695e2e4193db5e',
            comments_url:
              'https://api.github.com/repos/octocat/Hello-World/commits/6dcb09b5b57875f334f61aebed695e2e4193db5e/comments',
            commit: {
              url:
                'https://api.github.com/repos/octocat/Hello-World/git/commits/6dcb09b5b57875f334f61aebed695e2e4193db5e',
              author: {
                name: 'Monalisa Octocat',
                email: 'support@github.com',
                date: '2011-04-14T16:00:49Z',
              },
              committer: {
                name: 'Monalisa Octocat',
                email: 'support@github.com',
                date: '2011-04-14T16:00:49Z',
              },
              message: 'Fix all the bugs',
              tree: {
                url:
                  'https://api.github.com/repos/octocat/Hello-World/tree/6dcb09b5b57875f334f61aebed695e2e4193db5e',
                sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
              },
              comment_count: 0,
              verification: {
                verified: false,
                reason: 'unsigned',
                signature: null,
                payload: null,
              },
            },
            author: {
              login: 'octocat',
              id: 1,
              node_id: 'MDQ6VXNlcjE=',
              avatar_url: 'https://github.com/images/error/octocat_happy.gif',
              gravatar_id: '',
              url: 'https://api.github.com/users/octocat',
              html_url: 'https://github.com/octocat',
              followers_url: 'https://api.github.com/users/octocat/followers',
              following_url:
                'https://api.github.com/users/octocat/following{/other_user}',
              gists_url: 'https://api.github.com/users/octocat/gists{/gist_id}',
              starred_url:
                'https://api.github.com/users/octocat/starred{/owner}{/repo}',
              subscriptions_url:
                'https://api.github.com/users/octocat/subscriptions',
              organizations_url: 'https://api.github.com/users/octocat/orgs',
              repos_url: 'https://api.github.com/users/octocat/repos',
              events_url:
                'https://api.github.com/users/octocat/events{/privacy}',
              received_events_url:
                'https://api.github.com/users/octocat/received_events',
              type: 'User',
              site_admin: false,
            },
            committer: {
              login: 'octocat',
              id: 1,
              node_id: 'MDQ6VXNlcjE=',
              avatar_url: 'https://github.com/images/error/octocat_happy.gif',
              gravatar_id: '',
              url: 'https://api.github.com/users/octocat',
              html_url: 'https://github.com/octocat',
              followers_url: 'https://api.github.com/users/octocat/followers',
              following_url:
                'https://api.github.com/users/octocat/following{/other_user}',
              gists_url: 'https://api.github.com/users/octocat/gists{/gist_id}',
              starred_url:
                'https://api.github.com/users/octocat/starred{/owner}{/repo}',
              subscriptions_url:
                'https://api.github.com/users/octocat/subscriptions',
              organizations_url: 'https://api.github.com/users/octocat/orgs',
              repos_url: 'https://api.github.com/users/octocat/repos',
              events_url:
                'https://api.github.com/users/octocat/events{/privacy}',
              received_events_url:
                'https://api.github.com/users/octocat/received_events',
              type: 'User',
              site_admin: false,
            },
            parents: [
              {
                url:
                  'https://api.github.com/repos/octocat/Hello-World/commits/6dcb09b5b57875f334f61aebed695e2e4193db5e',
                sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
              },
            ],
          },
        ];
      };

      mergeOnGreen.getStatusi = async () => {
        return [
          {
            url:
              'https://api.github.com/repos/octocat/Hello-World/statuses/6dcb09b5b57875f334f61aebed695e2e4193db5e',
            avatar_url: 'https://github.com/images/error/hubot_happy.gif',
            id: 1,
            node_id: 'MDY6U3RhdHVzMQ==',
            state: 'success',
            description: 'Build has completed successfully',
            target_url: 'https://ci.example.com/1000/output',
            context: 'Kokoro - Test: Binary Compatibility',
            created_at: '2012-07-20T01:19:13Z',
            updated_at: '2012-07-20T01:19:13Z',
            creator: {
              login: 'octocat',
              id: 1,
              node_id: 'MDQ6VXNlcjE=',
              avatar_url: 'https://github.com/images/error/octocat_happy.gif',
              gravatar_id: '',
              url: 'https://api.github.com/users/octocat',
              html_url: 'https://github.com/octocat',
              followers_url: 'https://api.github.com/users/octocat/followers',
              following_url:
                'https://api.github.com/users/octocat/following{/other_user}',
              gists_url: 'https://api.github.com/users/octocat/gists{/gist_id}',
              starred_url:
                'https://api.github.com/users/octocat/starred{/owner}{/repo}',
              subscriptions_url:
                'https://api.github.com/users/octocat/subscriptions',
              organizations_url: 'https://api.github.com/users/octocat/orgs',
              repos_url: 'https://api.github.com/users/octocat/repos',
              events_url:
                'https://api.github.com/users/octocat/events{/privacy}',
              received_events_url:
                'https://api.github.com/users/octocat/received_events',
              type: 'User',
              site_admin: false,
            },
          },
        ];
      };

      mergeOnGreen.getMOGLabel = async () => {
        // nock('https://api.github.com').log(console.log)
        // .get('/repos/testOwner/testRepo/issues/1/labels')
        // .reply(200, [
        //   {
        //     "id": 208045946,
        //     "node_id": "MDU6TGFiZWwyMDgwNDU5NDY=",
        //     "url": "https://api.github.com/repos/octocat/Hello-World/labels/bug",
        //     "name": "automerge",
        //     "description": "Something isn't working",
        //     "color": "f29513",
        //     "default": true
        //   },
        //   {
        //     "id": 208045947,
        //     "node_id": "MDU6TGFiZWwyMDgwNDU5NDc=",
        //     "url": "https://api.github.com/repos/octocat/Hello-World/labels/enhancement",
        //     "name": "enhancement",
        //     "description": "New feature or request",
        //     "color": "a2eeef",
        //     "default": false
        //   }
        // ])

        return true;
      };

      await probot.receive({
        name: 'schedule.repository',
        payload: {
          number: 1,
          repo: 'testRepo',
          owner: 'testOwner',
          state: 'continue',
        },
        id: 'abc123',
      });
    });*/
