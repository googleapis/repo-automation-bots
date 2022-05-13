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

import {Cmd, newCmd} from './cmd';

const defaultCmd = newCmd();

/**
 * Returns true if the specified directory has any git changes
 * @param {string} cwd Directory to check
 * @param {Cmd} cmd Optional command executor
 * @returns {boolean} Returns true if there are any pending git changes
 */
export function hasGitChanges(cwd: string, cmd: Cmd = defaultCmd): boolean {
  // `git status` --porcelain returns empty stdout when no changes are pending.
  // We don't need the entire list, so only check to see if there's a single line
  const status = cmd('git status . --porcelain | head -n 1', {cwd})
    .toString('utf-8')
    .trim();
  return !status;
}
