// Copyright 2021 Google LLC
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

/* eslint-disable @typescript-eslint/no-explicit-any */

import {CloudBuildClient} from '@google-cloud/cloudbuild';
export interface FakeCloudBuildClient {
  readonly calls: any[][];
}

class FakeClient implements FakeCloudBuildClient {
  calls: any[][] = [];

  runBuildTrigger(...args: any[]) {
    this.calls.push(args);
    return Promise.resolve([
      {
        metadata: {
          build: {
            id: '73',
          },
        },
      },
    ]);
  }
}

/**
 * Creates a new CloudBuildClient witha calls[] property recording calls to
 * runBuildTrigger().
 */
export function newFakeCloudBuildClient() {
  return new FakeClient() as unknown as FakeCloudBuildClient & CloudBuildClient;
}
