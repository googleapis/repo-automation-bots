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

export const MERGE_ON_GREEN_LABEL = 'automerge';
export const MERGE_ON_GREEN_LABEL_SECURE = 'automerge: exact';

export const MERGE_ON_GREEN_LABELS = [
  {
    name: MERGE_ON_GREEN_LABEL,
    description: 'Summon MOG for automerging',
  },
  {
    name: MERGE_ON_GREEN_LABEL_SECURE,
    description:
      'Summon MOG for automerging, but approvals need to be against the latest commit',
  },
];
