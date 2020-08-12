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
import {
  GCF,
  CloudFunctionQuery,
  CloudFunctionsCallback,
  CloudFunction,
} from 'googleapis-nodejs-functions';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ReturnValue = [CloudFunction[], any];

/**
 * A mock client to mimic googleapis-nodejs-functions/GCF
 */
export class MockCloudFunctionsClient extends GCF {
  private mockData: ReturnValue;
  private getShouldThrow = false;

  constructor(mockData?: ReturnValue) {
    super();
    this.mockData = mockData || [[], null];
  }

  /**
   * Set the mock data to be returned by this client
   * @param mockData mock data to return
   */
  public setMockData(mockData: ReturnValue) {
    this.mockData = mockData;
  }

  /**
   * Will cause the next calls to getCloudFunctions to throw an error
   */
  public throwOnGet() {
    this.getShouldThrow = true;
  }

  /**
   * Returns the mock Cloud Functions set in this client
   * @param query parameter is ignored
   * @param callback parameter is ignored
   */
  getCloudFunctions(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    query?: CloudFunctionQuery,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    callback?: CloudFunctionsCallback
  ): void | Promise<ReturnValue> {
    if (this.getShouldThrow) {
      throw new Error('This is a mock error');
    }
    return new Promise(resolve => {
      setTimeout(() => resolve(this.mockData), 100); // simulates network delay
    });
  }
}
