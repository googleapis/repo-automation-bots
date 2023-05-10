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

export interface ConfigurationOptions {
  jobName?: string;
  enabled?: boolean;
  multiScmName?: string;
  /// Trigger a new release even when there isn't a corresponding release
  /// please pull request.
  triggerWithoutPullRequest?: boolean;
  /// The programming language whose publishing pipeline to invoke.
  /// Required when triggerWithoutPullRequest is true.
  lang?: string;
}

export const WELL_KNOWN_CONFIGURATION_FILE = 'release-trigger.yml';
export const DEFAULT_CONFIGURATION: ConfigurationOptions = {
  enabled: true,
};
