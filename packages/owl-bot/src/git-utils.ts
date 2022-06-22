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

import * as proc from 'child_process';

/**
 * Returns true if the specified directory has any git changes
 * @param {string} cwd Directory to check
 * @returns {boolean} Returns true if there are any pending git changes
 */
export function hasGitChanges(cwd: string): Promise<boolean> {
  // `git status` --porcelain returns empty stdout when no changes are pending.
  // We don't need the entire list.  Just check if there's *any* output.
  const cmd = 'git';
  const args = ['status', '.', '--porcelain'];
  console.log([cmd, ...args].join(' '));
  const child = proc.spawn(cmd, args, {cwd});
  return new Promise<boolean>((resolve, reject) => {
    child.stderr.on('data', data => reject(data));
    child.stdout.on('data', () => resolve(true));
    child.on('close', () => resolve(false));
  });
}
