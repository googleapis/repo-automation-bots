// Copyright 2022 Google LLC
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

/**
 * Records the build id for builds that run the post processor on code that's
 * been copied from googleapis-gen into the client library repos.
 */
export interface CopyStateStore {
  /**
   * Records a build id of the post-processor run that was started for
   * code copied into a client library repository.
   * @param a unique id for the copy operation.
   * @param buildId the google cloud build id.
   */
  recordBuildForCopy(copyTag: string, buildId: string): Promise<void>;

  /**
   * Finds an existing branch for the copy operation.
   * @param a unique id for the copy operation.
   * @returns the empty string if none exists.
   */
  findBuildForCopy(copyTag: string): Promise<string | undefined>;
}
