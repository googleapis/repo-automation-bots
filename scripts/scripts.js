#!/usr/bin/env node

// Copyright 2020 Google LLC
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

const fs = require('fs').promises;
const { execSync } = require('child_process');

/**
 * Runs an arbitrary command in each directory in the `packages` dir.
 * Example:
 *    $ npm run run -- npm test
 */
async function main() {
  const files = await fs.readdir('./packages', { withFileTypes: true });
  const dirs = files.filter(f => f.isDirectory());
  const cmd = process.argv.slice(2).join(' ');
  dirs.forEach(d => {
    console.log(cmd, d.name);
    execSync(cmd, {
      stdio: 'inherit',
      cwd: `packages/${d.name}`
    });
  });
}
main().catch(e => {
  console.error(e);
  process.exit(-1);
});
