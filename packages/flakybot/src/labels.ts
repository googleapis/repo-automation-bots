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

export const ISSUE_LABEL = 'flakybot: issue';
export const FLAKY_LABEL = 'flakybot: flaky';
export const QUIET_LABEL = 'flakybot: quiet';

export const FLAKYBOT_LABELS = [
  // assuming ISSUE_LABEL and FLAKY_LABEL are already created and
  // people are familiar with the current color.
  // Currently we only sync QUIET_LABEL for usability.
  {
    name: QUIET_LABEL,
    description: 'Instruct flakybot to be silent',
  },
];
