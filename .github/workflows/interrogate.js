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

const {execSync} = require('child_process');
const fs = require('fs');
const outputFile = process.env.GITHUB_OUTPUT;

function writeOutput(name, value) {
  fs.appendFileSync(outputFile, `${name}=${value}\n`);
}

const baseRef = process.env.GITHUB_BASE_REF;
let status;

if (baseRef) {
  console.log(`base ref: ${baseRef}`);
  status = execSync(`git diff --name-only origin/${baseRef}`, { encoding: 'utf-8'});
} else {
  // If we're on the main branch, run tests based on last commit:
  console.log(`running against last commit`);
  execSync(`git checkout HEAD^`);
  status = execSync(`git diff --name-only HEAD~1`, { encoding: 'utf-8'});
}
console.log(status);
const changes = status.split('\n');
let nodePaths = new Set();
let goPaths = new Set();
let bashPaths = new Set();
for (const change of changes) {
  if (change.startsWith('packages/')) {
    if (change.startsWith('packages/monitoring-system')) {
      // Currently our test pipeline does not allow us to delete an
      // existing package. We may want to handle it better in the
      // future.
      continue;
    } else {
      nodePaths.add(change.split('/')[1]);
    }
  };
  if (change.startsWith('packages/flakybot/')) {
    goPaths.add('packages/flakybot')
  }
  if (change.startsWith('serverless-scheduler-proxy/')) {
    goPaths.add('serverless-scheduler-proxy');
  }
  if (change.startsWith('scripts/')) {
    bashPaths.add('scripts');
  }
}
nodePaths = Array.from(nodePaths);
goPaths = Array.from(goPaths);
bashPaths = Array.from(bashPaths);
const requiredJobs = [
  'changeFinder',
  ...nodePaths.map(p => `test (${p})`),
  ...goPaths.map(p => `go-test (${p})`),
  ...bashPaths.map(p => `bash-test (${p})`),
];

console.log(nodePaths, '\n', goPaths, '\n', bashPaths, '\n', requiredJobs);
writeOutput('nodePaths', JSON.stringify(nodePaths));
writeOutput('goPaths', JSON.stringify(goPaths));
writeOutput('bashPaths', JSON.stringify(bashPaths));
writeOutput('requiredJobs', JSON.stringify(requiredJobs));
