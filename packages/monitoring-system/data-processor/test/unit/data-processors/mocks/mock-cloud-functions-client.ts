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
import {protos, CloudFunctionsServiceClient} from '@google-cloud/functions';
type CloudFunction = protos.google.cloud.functions.v1.CloudFunction;
type ListFunctionsRequest = protos.google.cloud.functions.v1.IListFunctionsRequest;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ReturnValue = [CloudFunction[], null, any];

/**
 * A mock client to mimic @google-cloud/functions
 */
export class MockCloudFunctionsClient extends CloudFunctionsServiceClient {
  private mockData: ReturnValue;
  private getShouldThrow = false;

  constructor(mockData?: ReturnValue) {
    super();
    this.mockData = mockData || [[], null, null];
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async listFunctions(_options: ListFunctionsRequest) {
    if (this.getShouldThrow) {
      throw new Error('This is a mock error');
    }
    // simulates network delay
    await new Promise(r => setTimeout(r, 100));
    return this.mockData;
  }
}
