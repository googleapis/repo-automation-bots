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

export const OWLBOT_RUN_LABEL = 'owlbot:run';
export const OWL_BOT_IGNORE = 'owlbot:ignore';

export const OWL_BOT_LABELS = [
  {
    name: OWLBOT_RUN_LABEL,
    description: 'instruct owl-bot to run',
  },
  {
    name: OWL_BOT_IGNORE,
    description: 'instruct owl-bot to ignore a PR',
  },
];
