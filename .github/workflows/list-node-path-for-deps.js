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

const {execSync} = require('child_process');

// We want to match sub packages like owlbot-bootstrapper/cli
const output = execSync(`find packages -type d -name node_modules -prune -o -name package-lock.json -print`, { encoding: 'utf-8' });
const packages = output.split('\n');
const nodePaths = new Set();
const excludes = ['mono-repo-publish/test/fixtures'];

for (const package of packages) {
  const parts = package.split('/');
  if (parts.length === 1) {
    // Exclude top level package-lock.json
    continue;
  }
  let packageDir = '';
  // Starting from the top level package name and ends at the last directory.
  for (let i = 1; i < parts.length - 1; i++) {
    packageDir += (i == 1 ? '' : '/') + parts[i];
  }
  if (!excludes.includes(packageDir)) {
    nodePaths.add(packageDir);
  }
}

console.log(`::set-output name=nodePaths::${JSON.stringify(Array.from(nodePaths))}`);
