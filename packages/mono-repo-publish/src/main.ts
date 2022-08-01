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

import {Octokit} from '@octokit/rest';
import {createAppAuth} from '@octokit/auth-app';
import * as fs from 'fs';
import {dirname, join, resolve} from 'path';
import * as childProcess from 'child_process';

interface PullRequest {
  owner: string;
  repo: string;
  number: number;
}

// TODO: this is a URL; split into owner, repo, and PR
// const prNumber = process.env.AUTORELEASE_PR;
// https://github.com/googleapis/releasetool/blob/master/releasetool/commands/publish_reporter.sh
export function parseURL(prURL: string): PullRequest | undefined {
  // looking for URLs that match this pattern: https://github.com/googleapis/release-please/pull/707
  const match = prURL.match(
    /^https:\/\/github\.com\/(?<owner>.+)\/(?<repo>.+)\/pull\/(?<number>\d+)$/
  );
  if (match?.groups) {
    return {
      owner: match.groups.owner,
      repo: match.groups.repo,
      number: Number(match.groups.number),
    };
  }
  return undefined;
}

export function getOctokitInstance(
  appIdPath: string,
  privateKeyPath: string,
  installationIdPath: string
): Octokit {
  const appId = fs.readFileSync(appIdPath, 'utf8');
  const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
  const installationId = fs.readFileSync(installationIdPath, 'utf8');

  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId,
      privateKey,
      installationId,
    },
  });
}

// pull in files in PR
export async function getsPRFiles(
  prObject: PullRequest,
  octokit: Octokit
): Promise<string[]> {
  const files = await octokit.paginate(octokit.pulls.listFiles, {
    owner: prObject.owner,
    repo: prObject.repo,
    pull_number: prObject.number,
  });
  console.log(files);
  return files.map(e => e.filename);
}

// list out the submodules that were changed
export function listChangedSubmodules(prFiles: string[]): string[] {
  // Only checking for package.jsons in submodules that were changed
  // Not checking the top-level package.json
  const files = prFiles.filter(file =>
    file.match(/\/package\.json$|^package\.json$/)
  );
  const directories = files.map(x => dirname(x));
  return directories;
}

export function publishSubmodules(
  directories: string[],
  dryRun: boolean,
  execSyncOverride?: typeof childProcess.execSync,
  rmSyncOverride?: typeof fs.rmSync
) {
  console.log(`Directories to publish: ${directories}`);
  const execSync = execSyncOverride || childProcess.execSync;
  const rmSync = rmSyncOverride || fs.rmSync;
  const errors = [];
  for (const directory of directories) {
    const installCommand = stat(resolve(directory, 'package-lock.json'))
      ? 'ci'
      : 'i';
    try {
      execSync(`npm ${installCommand} --registry=https://registry.npmjs.org`, {
        cwd: directory,
        stdio: 'inherit',
      });
      execSync(`npm publish --access=public${dryRun ? ' --dry-run' : ''}`, {
        cwd: directory,
        stdio: 'inherit',
      });
      rmSync(join(directory, 'node_modules'), {
        recursive: true,
        force: true,
      });
    } catch (err) {
      console.log(err);
      errors.push(err);
    }
  }
  return errors;
}

function stat(path: string) {
  try {
    return fs.statSync(path);
  } catch (e) {
    return undefined;
  }
}
