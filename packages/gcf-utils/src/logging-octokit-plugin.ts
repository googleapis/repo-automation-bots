import {Octokit} from '@octokit/rest';
import {logger} from './gcf-utils';

enum GitHubActionType {
  ISSUE_CREATE_LABEL = 'ISSUE_CREATE_LABEL',
  ISSUE_ADD_LABELS = 'ISSUE_ADD_LABELS',
  ISSUE_REMOVE_LABEL = 'ISSUE_REMOVE_LABEL',
  ISSUE_CREATE_COMMENT = 'ISSUE_CREATE_COMMENT',
  ISSUE_UPDATE_LABEL = 'ISSUE_UPDATE_LABEL',
  ISSUE_DELETE_LABEL = 'ISSUE_DELETE_LABEL',
  ISSUE_UPDATE = 'ISSUE_UPDATE',
  ISSUE_CREATE = 'ISSUE_CREATE',
  UNKNOWN = 'UNKNOWN',
}

enum GitHubObjectType {
  ISSUE = 'ISSUE',
  UNKNOWN = 'UNKNOWN',
}

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

interface GitHubActionDetails {
  type?: GitHubActionType;
  value?: string;
  dstObjType?: GitHubObjectType;
  dstObjId?: string | number;
  repoName?: string;
  repoOwner?: string;
}

interface MetricLogger {
  metric: {(data: GitHubActionLog): void};
}

/**
 * Maps GitHub API endpoints to a GitHubActionType
 */
const ActionUrlMap: {[url: string]: {[method: string]: GitHubActionType}} = {
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
};

/**
 * Parses the outgoing GitHub request to determine the details of the action being taken
 * @param options options from outgoing request
 */
function parseActionDetails(options: {
  [key: string]: string | number;
}): GitHubActionDetails {
  const actionType: GitHubActionType =
    ActionUrlMap[options.url][options.method] || GitHubActionType.UNKNOWN;

  const details: GitHubActionDetails = {};
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
      details.value = String(options.labels);
      break;
    case GitHubActionType.ISSUE_CREATE_COMMENT:
      details.value = String(options.body);
      break;
    case GitHubActionType.ISSUE_REMOVE_LABEL:
    case GitHubActionType.ISSUE_CREATE_LABEL:
    case GitHubActionType.ISSUE_DELETE_LABEL:
      details.value = String(options.name);
      break;
    case GitHubActionType.ISSUE_UPDATE_LABEL:
      details.value = `${options.current_name} to ${options.name}`;
      break;
    case GitHubActionType.ISSUE_UPDATE:
      details.value = 'updated: ';
      details.value += hasIssueUpdateProps.join(',');
      break;
    case GitHubActionType.ISSUE_CREATE:
      details.value = String(options.title);
      break;
  }
  if (options['issue_number']) {
    details.dstObjType = GitHubObjectType.ISSUE;
    details.dstObjId = options['issue_number'];
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
  const general = {
    type: details.type,
    value: details.value || 'UNKNOWN',
    destination_repo: {
      repo_name: details.repoName || 'UNKNOWN',
      owner: details.repoOwner || 'UNKNOWN',
    },
  };

  const destination_object =
    details.dstObjType || details.dstObjId
      ? {
          destination_object: {
            object_type: details.dstObjType || GitHubObjectType.UNKNOWN,
            object_id: details.dstObjId || 'UNKNOWN',
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
};
