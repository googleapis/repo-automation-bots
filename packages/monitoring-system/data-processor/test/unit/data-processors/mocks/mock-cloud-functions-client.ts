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
import {CloudFunctionsServiceClient, protos} from '@google-cloud/functions';
import {PaginationCallback, CallOptions, ClientOptions} from 'google-gax';

/**
 * Defining types for better readability
 */
type IRequest = protos.google.cloud.functions.v1.IListFunctionsRequest;
type IResponse = protos.google.cloud.functions.v1.IListFunctionsResponse;
type IFunction = protos.google.cloud.functions.v1.ICloudFunction;
type CallBack = PaginationCallback<
  IRequest,
  IResponse | null | undefined,
  IFunction
>;
type ReturnValue = [IFunction[], IRequest | null, IResponse];

/**
 * An interface for mock functions data
 */
export interface MockCloudFunctionsData {
  [project: string]: {
    [location: string]: ReturnValue;
  };
}

/**
 * A mock client to mimic CloudFunctionServiceClient
 */
export class MockCloudFunctionsClient extends CloudFunctionsServiceClient {
  private mockData: MockCloudFunctionsData;

  constructor(mockData?: MockCloudFunctionsData, options?: ClientOptions) {
    super(options);
    this.mockData = mockData || {};
  }

  /**
   * Set the mock data to be returned by this client
   * @param mockData mock data to return
   */
  public setMockData(mockData: MockCloudFunctionsData) {
    this.mockData = mockData;
  }

  /**
   * Return a fully qualified path to the location
   * @param project project for this path
   * @param location location within project
   */
  public locationPath(project: string, location: string): string {
    return `projects/${project}/locations/${location}`;
  }

  public listFunctions(
    request: IRequest,
    optionsOrCallback?: CallOptions | CallBack,
    callback?: CallBack
  ): Promise<ReturnValue> {
    return new Promise((resolve, reject) => {
      if (!request.parent) {
        reject('No path found');
      }
      const parts = request.parent?.split('/') || [];
      if (parts.length !== 4) {
        reject('Invalid path');
      }
      const project = this.mockData[parts[1]];
      if (!project) {
        reject(`Project ${parts[1]} does not exist`);
      }
      const location = project[parts[3]];
      if (!location) {
        reject(`Location ${parts[3]} does not exist`);
      }
      resolve(location);
    });
  }
}
