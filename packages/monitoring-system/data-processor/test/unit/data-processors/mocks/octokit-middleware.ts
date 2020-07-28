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
import {
  OctokitRequestParser,
  GitHubActionType,
  GitHubObjectType,
  GitHubActionDetails,
  OctokitRequestOptions,
} from './octokit-request-parser';

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

export interface MockResponse {
  type: 'resolve' | 'reject';
  value: {} | [];
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
    './build/test/unit/data-processors/mocks/mock-octokit-plugin.js';

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
  public getMockResponse(options: OctokitRequestOptions): Promise<{}> {
    const action = OctokitRequestParser.parseActionDetails(options);
    const {
      type,
      value,
      destObjId,
      destObjType,
      repoName,
      repoOwner,
    } = this.getStrictDetails(action);

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

  /**
   * Erases all previously set mock responses
   */
  public resetResponses() {
    this.mockResponses = {};
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
}
