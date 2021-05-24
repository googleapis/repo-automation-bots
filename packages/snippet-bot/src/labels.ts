// Copyright 2021 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

export const REFRESH_LABEL = 'snippet-bot:force-run';
export const NO_PREFIX_REQ_LABEL = 'snippet-bot:no-prefix-req';

export const SNIPPET_BOT_LABELS = [
  {
    name: REFRESH_LABEL,
    description: 'Force snippet-bot runs its logic',
  },
  {
    name: NO_PREFIX_REQ_LABEL,
    description: 'Instruct snippet-bot to ignore prefix requirement',
  },
];
