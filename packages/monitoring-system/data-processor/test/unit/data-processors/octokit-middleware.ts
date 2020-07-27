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
import {resolve} from 'path';

/**
 * Types of actions taken on GitHub
 */
export enum GitHubActionType {
  REPO_LIST_EVENTS = 'REPO_LIST_EVENTS',
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
  NONE = 'NONE',
}

/**
 * Destination objects for actions
 */
export enum GitHubObjectType {
  ISSUE = 'ISSUE',
  PR = 'PULL_REQUEST',
  NONE = 'NONE',
}

/**
 * Parsed details of GitHub action
 */
export interface GitHubActionDetails {
  type?: GitHubActionType;
  value?: string;
  destObjType?: GitHubObjectType;
  destObjId?: string | number;
  repoName?: string;
  repoOwner?: string;
}

/**
 * Parsed details of GitHub action
 */
interface GitHubActionDetailsStrict {
  type: GitHubActionType;
  value: string;
  destObjType: GitHubObjectType;
  destObjId: string | number;
  repoName: string;
  repoOwner: string;
}

/**
 * Maps GitHub API endpoints to a GitHubActionType
 */
const ActionEndpoints: {[url: string]: {[method: string]: GitHubActionType}} = {
  '/repos/{owner}/{repo}/events': {
    GET: GitHubActionType.REPO_LIST_EVENTS,
  },
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

export interface MockResponse {
  type: 'resolve' | 'reject';
  value: {};
}

interface MockResponses {
  [type: string]: {
    [value: string]: {
      [dstObjType: string]: {
        [destObjId: string]: {
          [repoName: string]: {
            [repoOwner: string]: MockResponse;
          };
        };
      };
    };
  };
}

/**
 * A middleware to intercept outgoing Octokit requests and
 * return predefined responses instead.
 */
export class OctokitMiddleware {
  private static PATH_TO_PLUGIN =
    './build/test/unit/data-processors/mock-octokit-plugin.js';

  private static instance: OctokitMiddleware;
  private mockResponses: MockResponses = {};

  /**
   * Returns a mock Octokit instance with OctokitMiddleware
   * injected into it.
   */
  public static getMockOctokit(): Octokit {
    const OctokitWithMiddleware = Octokit.plugin(
      require(resolve(this.PATH_TO_PLUGIN))
    );
    return new OctokitWithMiddleware();
  }

  /**
   * Returns the singleton instance of OctokitMiddleware
   */
  public static getMiddleware(): OctokitMiddleware {
    if (!this.instance) {
      this.instance = new OctokitMiddleware();
    }
    return this.instance;
  }

  /**
   * Get the mock response associated with the given request options
   * @param options
   */
  public getMockResponse(options: {
    [key: string]: string | number;
  }): Promise<{}> {
    const action = this.parseActionDetails(options);
    const {
      type,
      value,
      destObjId,
      destObjType,
      repoName,
      repoOwner,
    } = this.getStrictDetails(action);
    console.log({type, value, destObjId, destObjType, repoName, repoOwner});
    console.log(this.mockResponses);

    // TODO: Error handling for case when no mock response is set for these options
    const response = this.mockResponses[type][value][destObjType][destObjId][
      repoName
    ][repoOwner];
    return new Promise((resolve, reject) => {
      if (response.type === 'reject') {
        reject(response.value);
      } else {
        resolve(response.value);
      }
    });
  }

  /**
   * Set a mock response to be returned by OctokitMiddleware when the
   * given action is being taken by Octokit
   * @param action the action to mock
   * @param response the mock response
   */
  public setMockResponse(action: GitHubActionDetails, response: MockResponse) {
    const {
      type,
      value,
      destObjId,
      destObjType,
      repoName,
      repoOwner,
    } = this.getStrictDetails(action);
    let destination: {[key: string]: {}} = this.mockResponses;
    for (const key of [type, value, destObjType, destObjId, repoName]) {
      if (!destination[key]) {
        destination[key] = {};
      }
      destination = destination[key];
    }
    destination[repoOwner] = response;
  }

  /**
   * Return a rejected Promise when Octokit takes the given action
   * @param action action to reject on
   */
  public rejectOnAction(action: GitHubActionDetails) {
    this.setMockResponse(action, {
      type: 'reject',
      value: {Error: 'A mock error'},
    });
  }

  private getStrictDetails(
    action: GitHubActionDetails
  ): GitHubActionDetailsStrict {
    return {
      type: action.type || GitHubActionType.NONE,
      value: action.value || 'NONE',
      destObjType: action.destObjType || GitHubObjectType.NONE,
      destObjId: action.destObjId || 'NONE',
      repoName: action.repoName || 'NONE',
      repoOwner: action.repoOwner || 'NONE',
    };
  }

  private parseActionValue(
    actionType: GitHubActionType,
    options: {
      [key: string]: string | number;
    }
  ): string {
    const NO_ACTION_VALUE = 'NONE';

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
        return NO_ACTION_VALUE;
    }
  }

  /**
   * Parses the outgoing GitHub request to determine the details of the action being taken
   * @param options options from outgoing request
   */
  private parseActionDetails(options: {
    [key: string]: string | number;
  }): GitHubActionDetails {
    console.log(options);
    const endpointMethods = ActionEndpoints[options.url] || {};
    const actionType: GitHubActionType =
      endpointMethods[options.method] || GitHubActionType.NONE;

    const details: GitHubActionDetails = {};
    details.value = this.parseActionValue(actionType, options);

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
}
