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
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
import {logger} from '../gcf-utils';
import {
  OctokitRequestParser as parser,
  GitHubActionDetails,
  GitHubActionType,
  GitHubObjectType,
  OctokitRequestOptions,
} from './octokit-request-parser';

export const VERSION = '1.0.0';

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
 * A logger with a metric endpoint
 */
interface MetricLogger {
  metric: {(data: GitHubActionLog): void};
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
    const actionDetails: GitHubActionDetails = parser.parseActionDetails(
      options as OctokitRequestOptions
    );

    logGithubAction(octoLogger, actionDetails);
  });

  (
    octokit as Octokit & {
      loggingOctokitPluginVersion: string;
    }
  ).loggingOctokitPluginVersion = VERSION;
};
