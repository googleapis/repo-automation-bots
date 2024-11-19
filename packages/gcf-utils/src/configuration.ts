// Copyright 2023 Google LLC
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

export const RUNNING_IN_TEST = process.env.NODE_ENV === 'test';
// Adding 30 second delay for each batch with 30 tasks
export const DEFAULT_FLOW_CONTROL_DELAY_IN_SECOND = 30;

// Wrapper options for configuring the probot server
export interface WrapConfig {
  // Whether to enable octokit request logging
  logging: boolean;
  // Whether to skip the webhook secret verification. Useful for local testing
  skipVerification: boolean;
  // Number of times to attempt retries on cron requests
  maxCronRetries: number;
  // Number of times to attempt retries on webhook requests
  maxRetries: number;
  // Number of times to attempt retries on pub/sub requests
  maxPubSubRetries: number;
  // When batch scheduling cron requests, delay groups of requests by X seconds
  // to avoid flooding
  flowControlDelayInSeconds: number;
  // Whether or not to throttle on rate limiting
  throttleOnRateLimits: boolean;
}

// Default configuration options
export const DEFAULT_WRAP_CONFIG: WrapConfig = {
  logging: false,
  skipVerification: RUNNING_IN_TEST,
  maxCronRetries: 0,
  maxRetries: 10,
  maxPubSubRetries: 0,
  flowControlDelayInSeconds: DEFAULT_FLOW_CONTROL_DELAY_IN_SECOND,
  throttleOnRateLimits: true,
};
