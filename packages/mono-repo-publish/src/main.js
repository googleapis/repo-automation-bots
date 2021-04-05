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

const { Octokit } = require('@octokit/rest');
const { createAppAuth } = require('@octokit/auth-app');
const { readFileSync } = require('fs');
const { dirname } = require('path');
const childProcess = require('child_process');

// TODO: this is a URL; split into owner, repo, and PR
// const prNumber = process.env.AUTORELEASE_PR;
// https://github.com/googleapis/releasetool/blob/master/releasetool/commands/publish_reporter.sh
function parseURL (prURL) {
  // looking for URLs that match this pattern: https://github.com/googleapis/release-please/pull/707
  const match = prURL.match(/^https:\/\/github\.com\/(?<owner>.+)\/(?<repo>.+)\/pull\/(?<number>\d+)$/);
  if (match) {
    return {
      owner: match.groups.owner,
      repo: match.groups.repo,
      number: Number(match.groups.number)
    };
  }
}

function getOctokitInstance () {
  const appId = readFileSync(process.env.APP_ID_PATH, 'utf8');
  const privateKey = readFileSync(process.env.GITHUB_PRIVATE_KEY_PATH, 'utf8');
  const installationId = readFileSync(process.env.INSTALLATION_ID_PATH, 'utf8');

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey,
      installationId
    }
  });
}

// pull in files in PR
async function getsPRFiles (prObject, octokit) {
  const files = await octokit.paginate(octokit.pulls.listFiles, {
    owner: prObject.owner,
    repo: prObject.repo,
    pull_number: prObject.number
  });
  console.log(files);
  return files.map(e => e.filename);
}

// list out the submodules that were changed
function listChangedSubmodules (prFiles) {
  // Only checking for package.jsons in submodules that were changed
  // Not checking the top-level package.json
  const files = prFiles.filter(file => file.match(/\/package\.json$|^package\.json$/));
  const directories = files.map(x => dirname(x));
  return directories;
}

function publishSubmodules (directories, dryRun, execSyncOverride) {
  console.log(`Directories to publish: ${directories}`);
  const execSync = execSyncOverride || childProcess.execSync;
  for (const directory of directories) {
    try {
      execSync('npm i', { cwd: directory, stdio: 'inherit' });
      execSync(`npm publish --access=public${dryRun ? ' --dry-run' : ''}`, { cwd: directory, stdio: 'inherit' });
    } catch (err) {
      console.log(err);
    }
  }
}

module.exports = { parseURL, getOctokitInstance, getsPRFiles, listChangedSubmodules, publishSubmodules };
