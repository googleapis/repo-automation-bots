// Copyright 2020 Google LLC
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
//
import {Octokit} from '@octokit/rest';
import {logger} from './gcf-utils';

/**
 * Types of actions taken on GitHub
 */
enum GitHubActionType {
  ISSUE_CREATE_LABEL = 'ISSUE_CREATE_LABEL',
  ISSUE_ADD_LABELS = 'ISSUE_ADD_LABELS',
  ISSUE_REMOVE_LABEL = 'ISSUE_REMOVE_LABEL',
  ISSUE_CREATE_COMMENT = 'ISSUE_CREATE_COMMENT',
  ISSUE_UPDATE_LABEL = 'ISSUE_UPDATE_LABEL',
  ISSUE_DELETE_LABEL = 'ISSUE_DELETE_LABEL',
  ISSUE_UPDATE = 'ISSUE_UPDATE',
  ISSUE_CREATE = 'ISSUE_CREATE',
  PR_DISMISS_REVIIEW = 'PULL_REQUEST_DISMISS_REVIEW',
  PR_MERGE = 'PULL_REQUEST_MERGE',
  PR_UPDATE_BRANCH = 'PULL_REQUEST_UPDATE_BRANCH',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Destination objects for actions
 */
enum GitHubObjectType {
  ISSUE = 'ISSUE',
  PR = 'PULL_REQUEST',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Log object for a GitHub Action
 */
interface GitHubActionLog {
  action: {
    type: GitHubActionType;
    value: string;
    destination_object?: {
      object_type: GitHubObjectType;
      object_id: string | number;
    };
    destination_repo: {
      repo_name: string;
      owner: string;
    };
  };
}

/**
 * Parsed details of GitHub action
 */
interface GitHubActionDetails {
  type?: GitHubActionType;
  value?: string;
  destObjType?: GitHubObjectType;
  destObjId?: string | number;
  repoName?: string;
  repoOwner?: string;
}

/**
 * A logger with a metric endpoint
 */
interface MetricLogger {
  metric: {(data: GitHubActionLog): void};
}

/**
 * Maps GitHub API endpoints to a GitHubActionType
 */
const ActionEndpoints: {[url: string]: {[method: string]: GitHubActionType}} = {
  '/repos/:owner/:repo/issues/:issue_number/labels': {
    POST: GitHubActionType.ISSUE_ADD_LABELS,
  },
  '/repos/:owner/:repo/labels': {
    POST: GitHubActionType.ISSUE_CREATE_LABEL,
  },
  '/repos/:owner/:repo/issues/:issue_number/comments': {
    POST: GitHubActionType.ISSUE_CREATE_COMMENT,
  },
  '/repos/:owner/:repo/issues/:issue_number/labels/:name': {
    DELETE: GitHubActionType.ISSUE_REMOVE_LABEL,
  },
  '/repos/:owner/:repo/labels/:name': {
    DELETE: GitHubActionType.ISSUE_DELETE_LABEL,
  },
  '/repos/:owner/:repo/labels/:current_name': {
    PATCH: GitHubActionType.ISSUE_UPDATE_LABEL,
  },
  '/repos/:owner/:repo/issues/:issue_number': {
    PATCH: GitHubActionType.ISSUE_UPDATE,
  },
  '/repos/:owner/:repo/issues': {
    POST: GitHubActionType.ISSUE_CREATE,
  },
  '/repos/:owner/:repo/pulls/:pull_number/reviews/:review_id/dismissals': {
    PUT: GitHubActionType.PR_DISMISS_REVIIEW,
  },
  '/repos/:owner/:repo/pulls/:pull_number/merge': {
    PUT: GitHubActionType.PR_MERGE,
  },
  '/repos/:owner/:repo/pulls/:pull_number/update-branch': {
    PUT: GitHubActionType.PR_UPDATE_BRANCH,
  },
};

function parseActionValue(
  actionType: GitHubActionType,
  options: {
    [key: string]: string | number;
  }
): string {
  // optional properties for issues.update
  const allIssueUpdateProps = [
    'body',
    'state',
    'assignees',
    'labels',
    'milestone',
    'title',
  ];
  const hasIssueUpdateProps = allIssueUpdateProps.filter(
    (prop: string) => options[prop]
  );

  switch (actionType) {
    case GitHubActionType.ISSUE_ADD_LABELS:
      return String(options.labels);
    case GitHubActionType.ISSUE_CREATE_COMMENT:
      return String(options.body);
    case GitHubActionType.ISSUE_REMOVE_LABEL:
    case GitHubActionType.ISSUE_CREATE_LABEL:
    case GitHubActionType.ISSUE_DELETE_LABEL:
      return String(options.name);
    case GitHubActionType.ISSUE_UPDATE_LABEL:
      return `${options.current_name} to ${options.name}`;
    case GitHubActionType.ISSUE_UPDATE:
      return 'updated: ' + hasIssueUpdateProps.join(',');
    case GitHubActionType.ISSUE_CREATE:
      return String(options.title);
    case GitHubActionType.PR_DISMISS_REVIIEW:
      return `dismiss ${options.review_id}: ${options.message}`;
    case GitHubActionType.PR_MERGE:
    case GitHubActionType.PR_UPDATE_BRANCH:
    default:
      return 'NONE';
  }
}

/**
 * Parses the outgoing GitHub request to determine the details of the action being taken
 * @param options options from outgoing request
 */
function parseActionDetails(options: {
  [key: string]: string | number;
}): GitHubActionDetails {
  const actionType: GitHubActionType =
    ActionEndpoints[options.url][options.method] || GitHubActionType.UNKNOWN;

  const details: GitHubActionDetails = {};
  details.value = parseActionValue(actionType, options);

  if (options['issue_number']) {
    details.destObjType = GitHubObjectType.ISSUE;
    details.destObjId = options['issue_number'];
  } else if (options['pull_number']) {
    details.destObjType = GitHubObjectType.PR;
    details.destObjId = options['pull_number'];
  }

  details.repoName = String(options['repo']);
  details.repoOwner = String(options['owner']);
  details.type = actionType;

  return details;
}

/**
 * Log a GitHub action as a GitHubActionLog
 * @param logger logger instance
 * @param details action details
 */
function logGithubAction(logger: MetricLogger, details: GitHubActionDetails) {
  if (!details.type || details.type === GitHubActionType.UNKNOWN) {
    // don't log unknown action types
    return;
  }

  const UNKNOWN = 'UNKNOWN';
  const general = {
    type: details.type,
    value: details.value || UNKNOWN,
    destination_repo: {
      repo_name: details.repoName || UNKNOWN,
      owner: details.repoOwner || UNKNOWN,
    },
  };

  const destination_object =
    details.destObjType || details.destObjId
      ? {
          destination_object: {
            object_type: details.destObjType || GitHubObjectType.UNKNOWN,
            object_id: details.destObjId || UNKNOWN,
          },
        }
      : {};

  const githubAction: GitHubActionLog = {
    action: {...general, ...destination_object},
  };
  logger.metric(githubAction);
}

/**
 * Hooks into outgoing requests from Octokit to log metrics
 */
module.exports = (
  octokit: Octokit,
  pluginOptions: {customLogger?: MetricLogger}
) => {
  const octoLogger = pluginOptions.customLogger || logger;

  octokit.hook.before('request', async options => {
    const actionDetails: GitHubActionDetails = parseActionDetails(options);

    logGithubAction(octoLogger, actionDetails);
  });

  (octokit as Octokit & {
    loggingOctokitPluginVersion: string;
  }).loggingOctokitPluginVersion = '1.0.0';
};
