exports['file structure checks that the file content carries over 1'] = `
**/node_modules
**/coverage
test/fixtures
build/
docs/
protos/{
    "extends": "./node_modules/gts"
  }**/node_modules
**/coverage
test/fixtures
build/
docs/
protos/// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

module.exports = {
  ...require('gts/.prettierrc.json')
}
# helloWorld

Instructions are provided in [googleapis/repo-automation-bots](https://github.com/googleapis/repo-automation-bots/blob/master/README.md) for deploying and testing your bots.

This bot uses nock for mocking requests to GitHub, and snap-shot-it for capturing responses; This allows updates to the API surface to be treated as a visual diff, rather than tediously asserting against each field.

## Running tests:

\`npm run test\`

## To update snapshots:

\`npm run test:snap\`

## Contributing

If you have suggestions for how helloWorld could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the Contributing Guide.

License
Apache 2.0 © 2019 Google LLC.// Copyright 2019 Google LLC
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

import {GCFBootstrapper} from 'gcf-utils';
import appFn from './helloWorld';

const bootstrap = new GCFBootstrapper();
module.exports['helloWorld'] = bootstrap.gcf(appFn);
// Copyright 2019 Google LLC
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

import {Application} from 'probot';

const CONFIGURATION_FILE_PATH = 'helloWorld.yml';

interface Configuration {
  randomBoolean: boolean;
}

export = (app: Application) => {
  app.on(['issues.opened', 'pull_request.opened'], async context => {
    const config = (await context.config(
      CONFIGURATION_FILE_PATH,
      {}
    )) as Configuration;

    if (
      (context.payload.pull_request || context.payload.issue) &&
      config.randomBoolean
    ) {
      context.log.info('The bot is alive!');
      return;
    }
  });
};
// Copyright 2019 Google LLC
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

declare module 'promise-events' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  class EventEmitter {}
}
randomBoolean: true{
  "action": "opened",
  "issue": {
    "url": "https://api.github.com/repos/testOwner/testRepo/issues/5",
    "repository_url": "https://api.github.com/repos/testOwner/testRepo",
    "labels_url": "https://api.github.com/repos/testOwner/testRepo/issues/5/labels{/name}",
    "comments_url": "https://api.github.com/repos/testOwner/testRepo/issues/5/comments",
    "events_url": "https://api.github.com/repos/testOwner/testRepo/issues/5/events",
    "html_url": "https://github.com/testOwner/testRepo/issues/5",
    "id": 483744522,
    "node_id": "MDU6SXNzdWU0ODM3NDQ1MjI=",
    "number": 5,
    "title": "Test Issue #3",
    "user": {
      "login": "testuser2",
      "id": 31518063,
      "node_id": "MDQ6VXNlcjMxNTE4MDYz",
      "avatar_url": "https://avatars3.githubusercontent.com/u/31518063?v=4",
      "gravatar_id": "",
      "url": "https://api.github.com/users/testOwner",
      "html_url": "https://github.com/testOwner",
      "followers_url": "https://api.github.com/users/testOwner/followers",
      "following_url": "https://api.github.com/users/testOwner/following{/other_user}",
      "gists_url": "https://api.github.com/users/testOwner/gists{/gist_id}",
      "starred_url": "https://api.github.com/users/testOwner/starred{/owner}{/repo}",
      "subscriptions_url": "https://api.github.com/users/testOwner/subscriptions",
      "organizations_url": "https://api.github.com/users/testOwner/orgs",
      "repos_url": "https://api.github.com/users/testOwner/repos",
      "events_url": "https://api.github.com/users/testOwner/events{/privacy}",
      "received_events_url": "https://api.github.com/users/testOwner/received_events",
      "type": "User",
      "site_admin": false
    },
    "labels": [],
    "state": "open",
    "locked": false,
    "assignee": null,
    "assignees": [],
    "milestone": null,
    "comments": 0,
    "created_at": "2019-08-22T03:04:47Z",
    "updated_at": "2019-08-22T03:04:47Z",
    "closed_at": null,
    "author_association": "OWNER",
    "body": ""
  },
  "repository": {
    "id": 194351185,
    "node_id": "MDEwOlJlcG9zaXRvcnkxOTQzNTExODU=",
    "name": "testRepo",
    "full_name": "testOwner/testRepo",
    "private": true,
    "owner": {
      "login": "testOwner",
      "id": 31518063,
      "node_id": "MDQ6VXNlcjMxNTE4MDYz",
      "avatar_url": "https://avatars3.githubusercontent.com/u/31518063?v=4",
      "gravatar_id": "",
      "url": "https://api.github.com/users/testOwner",
      "html_url": "https://github.com/testOwner",
      "followers_url": "https://api.github.com/users/testOwner/followers",
      "following_url": "https://api.github.com/users/testOwner/following{/other_user}",
      "gists_url": "https://api.github.com/users/testOwner/gists{/gist_id}",
      "starred_url": "https://api.github.com/users/testOwner/starred{/owner}{/repo}",
      "subscriptions_url": "https://api.github.com/users/testOwner/subscriptions",
      "organizations_url": "https://api.github.com/users/testOwner/orgs",
      "repos_url": "https://api.github.com/users/testOwner/repos",
      "events_url": "https://api.github.com/users/testOwner/events{/privacy}",
      "received_events_url": "https://api.github.com/users/testOwner/received_events",
      "type": "User",
      "site_admin": false
    },
    "html_url": "https://github.com/testOwner/testRepo",
    "description": null,
    "fork": false,
    "url": "https://api.github.com/repos/testOwner/testRepo",
    "forks_url": "https://api.github.com/repos/testOwner/testRepo/forks",
    "keys_url": "https://api.github.com/repos/testOwner/testRepo/keys{/key_id}",
    "collaborators_url": "https://api.github.com/repos/testOwner/testRepo/collaborators{/collaborator}",
    "teams_url": "https://api.github.com/repos/testOwner/testRepo/teams",
    "hooks_url": "https://api.github.com/repos/testOwner/testRepo/hooks",
    "issue_events_url": "https://api.github.com/repos/testOwner/testRepo/issues/events{/number}",
    "events_url": "https://api.github.com/repos/testOwner/testRepo/events",
    "assignees_url": "https://api.github.com/repos/testOwner/testRepo/assignees{/user}",
    "branches_url": "https://api.github.com/repos/testOwner/testRepo/branches{/branch}",
    "tags_url": "https://api.github.com/repos/testOwner/testRepo/tags",
    "blobs_url": "https://api.github.com/repos/testOwner/testRepo/git/blobs{/sha}",
    "git_tags_url": "https://api.github.com/repos/testOwner/testRepo/git/tags{/sha}",
    "git_refs_url": "https://api.github.com/repos/testOwner/testRepo/git/refs{/sha}",
    "trees_url": "https://api.github.com/repos/testOwner/testRepo/git/trees{/sha}",
    "statuses_url": "https://api.github.com/repos/testOwner/testRepo/statuses/{sha}",
    "languages_url": "https://api.github.com/repos/testOwner/testRepo/languages",
    "stargazers_url": "https://api.github.com/repos/testOwner/testRepo/stargazers",
    "contributors_url": "https://api.github.com/repos/testOwner/testRepo/contributors",
    "subscribers_url": "https://api.github.com/repos/testOwner/testRepo/subscribers",
    "subscription_url": "https://api.github.com/repos/testOwner/testRepo/subscription",
    "commits_url": "https://api.github.com/repos/testOwner/testRepo/commits{/sha}",
    "git_commits_url": "https://api.github.com/repos/testOwner/testRepo/git/commits{/sha}",
    "comments_url": "https://api.github.com/repos/testOwner/testRepo/comments{/number}",
    "issue_comment_url": "https://api.github.com/repos/testOwner/testRepo/issues/comments{/number}",
    "contents_url": "https://api.github.com/repos/testOwner/testRepo/contents/{+path}",
    "compare_url": "https://api.github.com/repos/testOwner/testRepo/compare/{base}...{head}",
    "merges_url": "https://api.github.com/repos/testOwner/testRepo/merges",
    "archive_url": "https://api.github.com/repos/testOwner/testRepo/{archive_format}{/ref}",
    "downloads_url": "https://api.github.com/repos/testOwner/testRepo/downloads",
    "issues_url": "https://api.github.com/repos/testOwner/testRepo/issues{/number}",
    "pulls_url": "https://api.github.com/repos/testOwner/testRepo/pulls{/number}",
    "milestones_url": "https://api.github.com/repos/testOwner/testRepo/milestones{/number}",
    "notifications_url": "https://api.github.com/repos/testOwner/testRepo/notifications{?since,all,participating}",
    "labels_url": "https://api.github.com/repos/testOwner/testRepo/labels{/name}",
    "releases_url": "https://api.github.com/repos/testOwner/testRepo/releases{/id}",
    "deployments_url": "https://api.github.com/repos/testOwner/testRepo/deployments",
    "created_at": "2019-06-29T01:25:49Z",
    "updated_at": "2019-07-17T17:01:14Z",
    "pushed_at": "2019-07-17T17:01:12Z",
    "git_url": "git://github.com/testOwner/testRepo.git",
    "ssh_url": "git@github.com:testOwner/testRepo.git",
    "clone_url": "https://github.com/testOwner/testRepo.git",
    "svn_url": "https://github.com/testOwner/testRepo",
    "homepage": null,
    "size": 13,
    "stargazers_count": 0,
    "watchers_count": 0,
    "language": "Python",
    "has_issues": true,
    "has_projects": true,
    "has_downloads": true,
    "has_wiki": true,
    "has_pages": false,
    "forks_count": 0,
    "mirror_url": null,
    "archived": false,
    "disabled": false,
    "open_issues_count": 4,
    "license": {
      "key": "apache-2.0",
      "name": "Apache License 2.0",
      "spdx_id": "Apache-2.0",
      "url": "https://api.github.com/licenses/apache-2.0",
      "node_id": "MDc6TGljZW5zZTI="
    },
    "forks": 0,
    "open_issues": 4,
    "watchers": 0,
    "default_branch": "master"
  },
  "sender": {
    "login": "testUser2",
    "id": 31518063,
    "node_id": "MDQ6VXNlcjMxNTE4MDYz",
    "avatar_url": "https://avatars3.githubusercontent.com/u/31518063?v=4",
    "gravatar_id": "",
    "url": "https://api.github.com/users/testOwner",
    "html_url": "https://github.com/testOwner",
    "followers_url": "https://api.github.com/users/testOwner/followers",
    "following_url": "https://api.github.com/users/testOwner/following{/other_user}",
    "gists_url": "https://api.github.com/users/testOwner/gists{/gist_id}",
    "starred_url": "https://api.github.com/users/testOwner/starred{/owner}{/repo}",
    "subscriptions_url": "https://api.github.com/users/testOwner/subscriptions",
    "organizations_url": "https://api.github.com/users/testOwner/orgs",
    "repos_url": "https://api.github.com/users/testOwner/repos",
    "events_url": "https://api.github.com/users/testOwner/events{/privacy}",
    "received_events_url": "https://api.github.com/users/testOwner/received_events",
    "type": "User",
    "site_admin": false
  },
  "installation": {
    "id": 1219791,
    "node_id": "MDIzOkludGVncmF0aW9uSW5zdGFsbGF0aW9uMTIxOTc5MQ=="
  }
}{
  "action": "opened",
  "number": 6,
  "pull_request": {
    "url": "https://api.github.com/repos/testuser2/testRepo/pulls/6",
    "id": 310174209,
    "node_id": "MDExOlB1bGxSZXF1ZXN0MzEwMTc0MjA5",
    "html_url": "https://github.com/testuser2/testRepo/pull/6",
    "diff_url": "https://github.com/testuser2/testRepo/pull/6.diff",
    "patch_url": "https://github.com/testuser2/testRepo/pull/6.patch",
    "issue_url": "https://api.github.com/repos/testuser2/testRepo/issues/6",
    "number": 6,
    "state": "open",
    "locked": false,
    "title": "Assign pr",
    "user": {
      "login": "testuser2",
      "id": 31518063,
      "node_id": "MDQ6VXNlcjMxNTE4MDYz",
      "avatar_url": "https://avatars3.githubusercontent.com/u/31518063?v=4",
      "gravatar_id": "",
      "url": "https://api.github.com/users/testuser2",
      "html_url": "https://github.com/testuser2",
      "followers_url": "https://api.github.com/users/testuser2/followers",
      "following_url": "https://api.github.com/users/testuser2/following{/other_user}",
      "gists_url": "https://api.github.com/users/testuser2/gists{/gist_id}",
      "starred_url": "https://api.github.com/users/testuser2/starred{/owner}{/repo}",
      "subscriptions_url": "https://api.github.com/users/testuser2/subscriptions",
      "organizations_url": "https://api.github.com/users/testuser2/orgs",
      "repos_url": "https://api.github.com/users/testuser2/repos",
      "events_url": "https://api.github.com/users/testuser2/events{/privacy}",
      "received_events_url": "https://api.github.com/users/testuser2/received_events",
      "type": "User",
      "site_admin": false
    },
    "assignees": [],
    "body": "",
    "created_at": "2019-08-22T23:00:58Z",
    "updated_at": "2019-08-22T23:00:58Z",
    "closed_at": null,
    "merged_at": null,
    "merge_commit_sha": null,
    "assignee": null,
    "requested_reviewers": [],
    "requested_teams": [],
    "labels": [],
    "milestone": null,
    "commits_url": "https://api.github.com/repos/testuser2/testRepo/pulls/6/commits",
    "review_comments_url": "https://api.github.com/repos/testuser2/testRepo/pulls/6/comments",
    "review_comment_url": "https://api.github.com/repos/testuser2/testRepo/pulls/comments{/number}",
    "comments_url": "https://api.github.com/repos/testuser2/testRepo/issues/6/comments",
    "statuses_url": "https://api.github.com/repos/testuser2/testRepo/statuses/c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a",
    "head": {
      "label": "testuser2:assign_pr",
      "ref": "assign_pr",
      "sha": "c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a",
      "user": {
        "login": "testuser2",
        "id": 31518063,
        "node_id": "MDQ6VXNlcjMxNTE4MDYz",
        "avatar_url": "https://avatars3.githubusercontent.com/u/31518063?v=4",
        "gravatar_id": "",
        "url": "https://api.github.com/users/testuser2",
        "html_url": "https://github.com/testuser2",
        "followers_url": "https://api.github.com/users/testuser2/followers",
        "following_url": "https://api.github.com/users/testuser2/following{/other_user}",
        "gists_url": "https://api.github.com/users/testuser2/gists{/gist_id}",
        "starred_url": "https://api.github.com/users/testuser2/starred{/owner}{/repo}",
        "subscriptions_url": "https://api.github.com/users/testuser2/subscriptions",
        "organizations_url": "https://api.github.com/users/testuser2/orgs",
        "repos_url": "https://api.github.com/users/testuser2/repos",
        "events_url": "https://api.github.com/users/testuser2/events{/privacy}",
        "received_events_url": "https://api.github.com/users/testuser2/received_events",
        "type": "User",
        "site_admin": false
      },
      "repo": {
        "id": 194351185,
        "node_id": "MDEwOlJlcG9zaXRvcnkxOTQzNTExODU=",
        "name": "testRepo",
        "full_name": "testuser2/testRepo",
        "private": true,
        "owner": {
          "login": "testOwner",
          "id": 31518063,
          "node_id": "MDQ6VXNlcjMxNTE4MDYz",
          "avatar_url": "https://avatars3.githubusercontent.com/u/31518063?v=4",
          "gravatar_id": "",
          "url": "https://api.github.com/users/testuser2",
          "html_url": "https://github.com/testuser2",
          "followers_url": "https://api.github.com/users/testuser2/followers",
          "following_url": "https://api.github.com/users/testuser2/following{/other_user}",
          "gists_url": "https://api.github.com/users/testuser2/gists{/gist_id}",
          "starred_url": "https://api.github.com/users/testuser2/starred{/owner}{/repo}",
          "subscriptions_url": "https://api.github.com/users/testuser2/subscriptions",
          "organizations_url": "https://api.github.com/users/testuser2/orgs",
          "repos_url": "https://api.github.com/users/testuser2/repos",
          "events_url": "https://api.github.com/users/testuser2/events{/privacy}",
          "received_events_url": "https://api.github.com/users/testuser2/received_events",
          "type": "User",
          "site_admin": false
        },
        "html_url": "https://github.com/testuser2/testRepo",
        "description": null,
        "fork": false,
        "url": "https://api.github.com/repos/testuser2/testRepo",
        "forks_url": "https://api.github.com/repos/testuser2/testRepo/forks",
        "keys_url": "https://api.github.com/repos/testuser2/testRepo/keys{/key_id}",
        "collaborators_url": "https://api.github.com/repos/testuser2/testRepo/collaborators{/collaborator}",
        "teams_url": "https://api.github.com/repos/testuser2/testRepo/teams",
        "hooks_url": "https://api.github.com/repos/testuser2/testRepo/hooks",
        "issue_events_url": "https://api.github.com/repos/testuser2/testRepo/issues/events{/number}",
        "events_url": "https://api.github.com/repos/testuser2/testRepo/events",
        "assignees_url": "https://api.github.com/repos/testuser2/testRepo/assignees{/user}",
        "branches_url": "https://api.github.com/repos/testuser2/testRepo/branches{/branch}",
        "tags_url": "https://api.github.com/repos/testuser2/testRepo/tags",
        "blobs_url": "https://api.github.com/repos/testuser2/testRepo/git/blobs{/sha}",
        "git_tags_url": "https://api.github.com/repos/testuser2/testRepo/git/tags{/sha}",
        "git_refs_url": "https://api.github.com/repos/testuser2/testRepo/git/refs{/sha}",
        "trees_url": "https://api.github.com/repos/testuser2/testRepo/git/trees{/sha}",
        "statuses_url": "https://api.github.com/repos/testuser2/testRepo/statuses/{sha}",
        "languages_url": "https://api.github.com/repos/testuser2/testRepo/languages",
        "stargazers_url": "https://api.github.com/repos/testuser2/testRepo/stargazers",
        "contributors_url": "https://api.github.com/repos/testuser2/testRepo/contributors",
        "subscribers_url": "https://api.github.com/repos/testuser2/testRepo/subscribers",
        "subscription_url": "https://api.github.com/repos/testuser2/testRepo/subscription",
        "commits_url": "https://api.github.com/repos/testuser2/testRepo/commits{/sha}",
        "git_commits_url": "https://api.github.com/repos/testuser2/testRepo/git/commits{/sha}",
        "comments_url": "https://api.github.com/repos/testuser2/testRepo/comments{/number}",
        "issue_comment_url": "https://api.github.com/repos/testuser2/testRepo/issues/comments{/number}",
        "contents_url": "https://api.github.com/repos/testuser2/testRepo/contents/{+path}",
        "compare_url": "https://api.github.com/repos/testuser2/testRepo/compare/{base}...{head}",
        "merges_url": "https://api.github.com/repos/testuser2/testRepo/merges",
        "archive_url": "https://api.github.com/repos/testuser2/testRepo/{archive_format}{/ref}",
        "downloads_url": "https://api.github.com/repos/testuser2/testRepo/downloads",
        "issues_url": "https://api.github.com/repos/testuser2/testRepo/issues{/number}",
        "pulls_url": "https://api.github.com/repos/testuser2/testRepo/pulls{/number}",
        "milestones_url": "https://api.github.com/repos/testuser2/testRepo/milestones{/number}",
        "notifications_url": "https://api.github.com/repos/testuser2/testRepo/notifications{?since,all,participating}",
        "labels_url": "https://api.github.com/repos/testuser2/testRepo/labels{/name}",
        "releases_url": "https://api.github.com/repos/testuser2/testRepo/releases{/id}",
        "deployments_url": "https://api.github.com/repos/testuser2/testRepo/deployments",
        "created_at": "2019-06-29T01:25:49Z",
        "updated_at": "2019-08-22T21:07:34Z",
        "pushed_at": "2019-08-22T21:07:32Z",
        "git_url": "git://github.com/testuser2/testRepo.git",
        "ssh_url": "git@github.com:testuser2/testRepo.git",
        "clone_url": "https://github.com/testuser2/testRepo.git",
        "svn_url": "https://github.com/testuser2/testRepo",
        "homepage": null,
        "size": 14,
        "stargazers_count": 0,
        "watchers_count": 0,
        "language": "Python",
        "has_issues": true,
        "has_projects": true,
        "has_downloads": true,
        "has_wiki": true,
        "has_pages": false,
        "forks_count": 0,
        "mirror_url": null,
        "archived": false,
        "disabled": false,
        "open_issues_count": 5,
        "license": {
          "key": "apache-2.0",
          "name": "Apache License 2.0",
          "spdx_id": "Apache-2.0",
          "url": "https://api.github.com/licenses/apache-2.0",
          "node_id": "MDc6TGljZW5zZTI="
        },
        "forks": 0,
        "open_issues": 5,
        "watchers": 0,
        "default_branch": "master"
      }
    },
    "base": {
      "label": "testuser2:master",
      "ref": "master",
      "sha": "7dfdda6032153d27e6555482b3e88ded77ae5a6a",
      "user": {
        "login": "testuser2",
        "id": 31518063,
        "node_id": "MDQ6VXNlcjMxNTE4MDYz",
        "avatar_url": "https://avatars3.githubusercontent.com/u/31518063?v=4",
        "gravatar_id": "",
        "url": "https://api.github.com/users/testuser2",
        "html_url": "https://github.com/testuser2",
        "followers_url": "https://api.github.com/users/testuser2/followers",
        "following_url": "https://api.github.com/users/testuser2/following{/other_user}",
        "gists_url": "https://api.github.com/users/testuser2/gists{/gist_id}",
        "starred_url": "https://api.github.com/users/testuser2/starred{/owner}{/repo}",
        "subscriptions_url": "https://api.github.com/users/testuser2/subscriptions",
        "organizations_url": "https://api.github.com/users/testuser2/orgs",
        "repos_url": "https://api.github.com/users/testuser2/repos",
        "events_url": "https://api.github.com/users/testuser2/events{/privacy}",
        "received_events_url": "https://api.github.com/users/testuser2/received_events",
        "type": "User",
        "site_admin": false
      },
      "repo": {
        "id": 194351185,
        "node_id": "MDEwOlJlcG9zaXRvcnkxOTQzNTExODU=",
        "name": "testRepo",
        "full_name": "testOwner/testRepo",
        "private": true,
        "owner": {
          "login": "testOwner",
          "id": 31518063,
          "node_id": "MDQ6VXNlcjMxNTE4MDYz",
          "avatar_url": "https://avatars3.githubusercontent.com/u/31518063?v=4",
          "gravatar_id": "",
          "url": "https://api.github.com/users/testuser2",
          "html_url": "https://github.com/testuser2",
          "followers_url": "https://api.github.com/users/testuser2/followers",
          "following_url": "https://api.github.com/users/testuser2/following{/other_user}",
          "gists_url": "https://api.github.com/users/testuser2/gists{/gist_id}",
          "starred_url": "https://api.github.com/users/testuser2/starred{/owner}{/repo}",
          "subscriptions_url": "https://api.github.com/users/testuser2/subscriptions",
          "organizations_url": "https://api.github.com/users/testuser2/orgs",
          "repos_url": "https://api.github.com/users/testuser2/repos",
          "events_url": "https://api.github.com/users/testuser2/events{/privacy}",
          "received_events_url": "https://api.github.com/users/testuser2/received_events",
          "type": "User",
          "site_admin": false
        },
        "html_url": "https://github.com/testuser2/testRepo",
        "description": null,
        "fork": false,
        "url": "https://api.github.com/repos/testuser2/testRepo",
        "forks_url": "https://api.github.com/repos/testuser2/testRepo/forks",
        "keys_url": "https://api.github.com/repos/testuser2/testRepo/keys{/key_id}",
        "collaborators_url": "https://api.github.com/repos/testuser2/testRepo/collaborators{/collaborator}",
        "teams_url": "https://api.github.com/repos/testuser2/testRepo/teams",
        "hooks_url": "https://api.github.com/repos/testuser2/testRepo/hooks",
        "issue_events_url": "https://api.github.com/repos/testuser2/testRepo/issues/events{/number}",
        "events_url": "https://api.github.com/repos/testuser2/testRepo/events",
        "assignees_url": "https://api.github.com/repos/testuser2/testRepo/assignees{/user}",
        "branches_url": "https://api.github.com/repos/testuser2/testRepo/branches{/branch}",
        "tags_url": "https://api.github.com/repos/testuser2/testRepo/tags",
        "blobs_url": "https://api.github.com/repos/testuser2/testRepo/git/blobs{/sha}",
        "git_tags_url": "https://api.github.com/repos/testuser2/testRepo/git/tags{/sha}",
        "git_refs_url": "https://api.github.com/repos/testuser2/testRepo/git/refs{/sha}",
        "trees_url": "https://api.github.com/repos/testuser2/testRepo/git/trees{/sha}",
        "statuses_url": "https://api.github.com/repos/testuser2/testRepo/statuses/{sha}",
        "languages_url": "https://api.github.com/repos/testuser2/testRepo/languages",
        "stargazers_url": "https://api.github.com/repos/testuser2/testRepo/stargazers",
        "contributors_url": "https://api.github.com/repos/testuser2/testRepo/contributors",
        "subscribers_url": "https://api.github.com/repos/testuser2/testRepo/subscribers",
        "subscription_url": "https://api.github.com/repos/testuser2/testRepo/subscription",
        "commits_url": "https://api.github.com/repos/testuser2/testRepo/commits{/sha}",
        "git_commits_url": "https://api.github.com/repos/testuser2/testRepo/git/commits{/sha}",
        "comments_url": "https://api.github.com/repos/testuser2/testRepo/comments{/number}",
        "issue_comment_url": "https://api.github.com/repos/testuser2/testRepo/issues/comments{/number}",
        "contents_url": "https://api.github.com/repos/testuser2/testRepo/contents/{+path}",
        "compare_url": "https://api.github.com/repos/testuser2/testRepo/compare/{base}...{head}",
        "merges_url": "https://api.github.com/repos/testuser2/testRepo/merges",
        "archive_url": "https://api.github.com/repos/testuser2/testRepo/{archive_format}{/ref}",
        "downloads_url": "https://api.github.com/repos/testuser2/testRepo/downloads",
        "issues_url": "https://api.github.com/repos/testuser2/testRepo/issues{/number}",
        "pulls_url": "https://api.github.com/repos/testuser2/testRepo/pulls{/number}",
        "milestones_url": "https://api.github.com/repos/testuser2/testRepo/milestones{/number}",
        "notifications_url": "https://api.github.com/repos/testuser2/testRepo/notifications{?since,all,participating}",
        "labels_url": "https://api.github.com/repos/testuser2/testRepo/labels{/name}",
        "releases_url": "https://api.github.com/repos/testuser2/testRepo/releases{/id}",
        "deployments_url": "https://api.github.com/repos/testuser2/testRepo/deployments",
        "created_at": "2019-06-29T01:25:49Z",
        "updated_at": "2019-08-22T21:07:34Z",
        "pushed_at": "2019-08-22T21:07:32Z",
        "git_url": "git://github.com/testuser2/testRepo.git",
        "ssh_url": "git@github.com:testuser2/testRepo.git",
        "clone_url": "https://github.com/testuser2/testRepo.git",
        "svn_url": "https://github.com/testuser2/testRepo",
        "homepage": null,
        "size": 14,
        "stargazers_count": 0,
        "watchers_count": 0,
        "language": "Python",
        "has_issues": true,
        "has_projects": true,
        "has_downloads": true,
        "has_wiki": true,
        "has_pages": false,
        "forks_count": 0,
        "mirror_url": null,
        "archived": false,
        "disabled": false,
        "open_issues_count": 5,
        "license": {
          "key": "apache-2.0",
          "name": "Apache License 2.0",
          "spdx_id": "Apache-2.0",
          "url": "https://api.github.com/licenses/apache-2.0",
          "node_id": "MDc6TGljZW5zZTI="
        },
        "forks": 0,
        "open_issues": 5,
        "watchers": 0,
        "default_branch": "master"
      }
    },
    "_links": {
      "self": {
        "href": "https://api.github.com/repos/testuser2/testRepo/pulls/6"
      },
      "html": {
        "href": "https://github.com/testuser2/testRepo/pull/6"
      },
      "issue": {
        "href": "https://api.github.com/repos/testuser2/testRepo/issues/6"
      },
      "comments": {
        "href": "https://api.github.com/repos/testuser2/testRepo/issues/6/comments"
      },
      "review_comments": {
        "href": "https://api.github.com/repos/testuser2/testRepo/pulls/6/comments"
      },
      "review_comment": {
        "href": "https://api.github.com/repos/testuser2/testRepo/pulls/comments{/number}"
      },
      "commits": {
        "href": "https://api.github.com/repos/testuser2/testRepo/pulls/6/commits"
      },
      "statuses": {
        "href": "https://api.github.com/repos/testuser2/testRepo/statuses/c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a"
      }
    },
    "author_association": "OWNER",
    "draft": false,
    "merged": false,
    "mergeable": null,
    "rebaseable": null,
    "mergeable_state": "unknown",
    "merged_by": null,
    "comments": 0,
    "review_comments": 0,
    "maintainer_can_modify": false,
    "commits": 2,
    "additions": 214,
    "deletions": 1,
    "changed_files": 3
  },
  "repository": {
    "id": 194351185,
    "node_id": "MDEwOlJlcG9zaXRvcnkxOTQzNTExODU=",
    "name": "testRepo",
    "full_name": "testuser2/testRepo",
    "private": true,
    "owner": {
      "login": "testOwner",
      "id": 31518063,
      "node_id": "MDQ6VXNlcjMxNTE4MDYz",
      "avatar_url": "https://avatars3.githubusercontent.com/u/31518063?v=4",
      "gravatar_id": "",
      "url": "https://api.github.com/users/testuser2",
      "html_url": "https://github.com/testuser2",
      "followers_url": "https://api.github.com/users/testuser2/followers",
      "following_url": "https://api.github.com/users/testuser2/following{/other_user}",
      "gists_url": "https://api.github.com/users/testuser2/gists{/gist_id}",
      "starred_url": "https://api.github.com/users/testuser2/starred{/owner}{/repo}",
      "subscriptions_url": "https://api.github.com/users/testuser2/subscriptions",
      "organizations_url": "https://api.github.com/users/testuser2/orgs",
      "repos_url": "https://api.github.com/users/testuser2/repos",
      "events_url": "https://api.github.com/users/testuser2/events{/privacy}",
      "received_events_url": "https://api.github.com/users/testuser2/received_events",
      "type": "User",
      "site_admin": false
    },
    "html_url": "https://github.com/testuser2/testRepo",
    "description": null,
    "fork": false,
    "url": "https://api.github.com/repos/testuser2/testRepo",
    "forks_url": "https://api.github.com/repos/testuser2/testRepo/forks",
    "keys_url": "https://api.github.com/repos/testuser2/testRepo/keys{/key_id}",
    "collaborators_url": "https://api.github.com/repos/testuser2/testRepo/collaborators{/collaborator}",
    "teams_url": "https://api.github.com/repos/testuser2/testRepo/teams",
    "hooks_url": "https://api.github.com/repos/testuser2/testRepo/hooks",
    "issue_events_url": "https://api.github.com/repos/testuser2/testRepo/issues/events{/number}",
    "events_url": "https://api.github.com/repos/testuser2/testRepo/events",
    "assignees_url": "https://api.github.com/repos/testuser2/testRepo/assignees{/user}",
    "branches_url": "https://api.github.com/repos/testuser2/testRepo/branches{/branch}",
    "tags_url": "https://api.github.com/repos/testuser2/testRepo/tags",
    "blobs_url": "https://api.github.com/repos/testuser2/testRepo/git/blobs{/sha}",
    "git_tags_url": "https://api.github.com/repos/testuser2/testRepo/git/tags{/sha}",
    "git_refs_url": "https://api.github.com/repos/testuser2/testRepo/git/refs{/sha}",
    "trees_url": "https://api.github.com/repos/testuser2/testRepo/git/trees{/sha}",
    "statuses_url": "https://api.github.com/repos/testuser2/testRepo/statuses/{sha}",
    "languages_url": "https://api.github.com/repos/testuser2/testRepo/languages",
    "stargazers_url": "https://api.github.com/repos/testuser2/testRepo/stargazers",
    "contributors_url": "https://api.github.com/repos/testuser2/testRepo/contributors",
    "subscribers_url": "https://api.github.com/repos/testuser2/testRepo/subscribers",
    "subscription_url": "https://api.github.com/repos/testuser2/testRepo/subscription",
    "commits_url": "https://api.github.com/repos/testuser2/testRepo/commits{/sha}",
    "git_commits_url": "https://api.github.com/repos/testuser2/testRepo/git/commits{/sha}",
    "comments_url": "https://api.github.com/repos/testuser2/testRepo/comments{/number}",
    "issue_comment_url": "https://api.github.com/repos/testuser2/testRepo/issues/comments{/number}",
    "contents_url": "https://api.github.com/repos/testuser2/testRepo/contents/{+path}",
    "compare_url": "https://api.github.com/repos/testuser2/testRepo/compare/{base}...{head}",
    "merges_url": "https://api.github.com/repos/testuser2/testRepo/merges",
    "archive_url": "https://api.github.com/repos/testuser2/testRepo/{archive_format}{/ref}",
    "downloads_url": "https://api.github.com/repos/testuser2/testRepo/downloads",
    "issues_url": "https://api.github.com/repos/testuser2/testRepo/issues{/number}",
    "pulls_url": "https://api.github.com/repos/testuser2/testRepo/pulls{/number}",
    "milestones_url": "https://api.github.com/repos/testuser2/testRepo/milestones{/number}",
    "notifications_url": "https://api.github.com/repos/testuser2/testRepo/notifications{?since,all,participating}",
    "labels_url": "https://api.github.com/repos/testuser2/testRepo/labels{/name}",
    "releases_url": "https://api.github.com/repos/testuser2/testRepo/releases{/id}",
    "deployments_url": "https://api.github.com/repos/testuser2/testRepo/deployments",
    "created_at": "2019-06-29T01:25:49Z",
    "updated_at": "2019-08-22T21:07:34Z",
    "pushed_at": "2019-08-22T21:07:32Z",
    "git_url": "git://github.com/testuser2/testRepo.git",
    "ssh_url": "git@github.com:testuser2/testRepo.git",
    "clone_url": "https://github.com/testuser2/testRepo.git",
    "svn_url": "https://github.com/testuser2/testRepo",
    "homepage": null,
    "size": 14,
    "stargazers_count": 0,
    "watchers_count": 0,
    "language": "Python",
    "has_issues": true,
    "has_projects": true,
    "has_downloads": true,
    "has_wiki": true,
    "has_pages": false,
    "forks_count": 0,
    "mirror_url": null,
    "archived": false,
    "disabled": false,
    "open_issues_count": 5,
    "license": {
      "key": "apache-2.0",
      "name": "Apache License 2.0",
      "spdx_id": "Apache-2.0",
      "url": "https://api.github.com/licenses/apache-2.0",
      "node_id": "MDc6TGljZW5zZTI="
    },
    "forks": 0,
    "open_issues": 5,
    "watchers": 0,
    "default_branch": "master"
  },
  "sender": {
    "login": "testuser2",
    "id": 31518063,
    "node_id": "MDQ6VXNlcjMxNTE4MDYz",
    "avatar_url": "https://avatars3.githubusercontent.com/u/31518063?v=4",
    "gravatar_id": "",
    "url": "https://api.github.com/users/testuser2",
    "html_url": "https://github.com/testuser2",
    "followers_url": "https://api.github.com/users/testuser2/followers",
    "following_url": "https://api.github.com/users/testuser2/following{/other_user}",
    "gists_url": "https://api.github.com/users/testuser2/gists{/gist_id}",
    "starred_url": "https://api.github.com/users/testuser2/starred{/owner}{/repo}",
    "subscriptions_url": "https://api.github.com/users/testuser2/subscriptions",
    "organizations_url": "https://api.github.com/users/testuser2/orgs",
    "repos_url": "https://api.github.com/users/testuser2/repos",
    "events_url": "https://api.github.com/users/testuser2/events{/privacy}",
    "received_events_url": "https://api.github.com/users/testuser2/received_events",
    "type": "User",
    "site_admin": false
  },
  "installation": {
    "id": 1219791,
    "node_id": "MDIzOkludGVncmF0aW9uSW5zdGFsbGF0aW9uMTIxOTc5MQ=="
  }
}// Copyright 2019 Google LLC
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

import myProbotApp from '../src/helloWorld';

import {resolve} from 'path';
import {Probot} from 'probot';
import nock from 'nock';
import * as fs from 'fs';
import {expect} from 'chai';
import {describe, it, beforeEach} from 'mocha';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('helloWorld', () => {
  let probot: Probot;

  const config = fs.readFileSync(
    resolve(fixturesPath, 'config', 'valid-config.yml')
  );

  beforeEach(() => {
    probot = new Probot({});

    probot.app = {
      getSignedJsonWebToken() {
        return 'abc123';
      },
      getInstallationAccessToken(): Promise<string> {
        return Promise.resolve('abc123');
      },
    };
    probot.load(myProbotApp);
  });

  describe('shows an example of how to use chai library', () => {
    it('confirms the random boolean is true', async () => {
      expect(config.toString()).to.include('true');
    });
  });

  describe('responds to events', () => {
    it('responds to a PR', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened'
      ));

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/helloWorld.yml')
        .reply(200, {content: config.toString('base64')});

      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });

      requests.done();
    });

    it('responds to issues', async () => {
      const payload = require(resolve(fixturesPath, './events/issue_opened'));

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/helloWorld.yml')
        .reply(200, {content: config.toString('base64')});

      await probot.receive({name: 'issues.opened', payload, id: 'abc123'});
      requests.done();
    });
  });
});
{
  "extends": "gts/tsconfig-google",
  "compilerOptions": {
    "esModuleInterop": true,
    "rootDir": ".",
    "outDir": "build"
  },
  "include": [
    "src/*.ts",
    "src/**/*.ts",
    "test/*.ts",
    "test/**/*.ts"
  ]
}

`
