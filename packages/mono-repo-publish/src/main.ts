// Copyright 2022 Google LLC
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
import * as mm from 'minimatch';

interface PullRequest {
  owner: string;
  repo: string;
  number: number;
}

export const methodOverrides: {
  execSyncOverride: typeof childProcess.execSync;
  rmSyncOverride: typeof fs.rmSync;
} = {
  execSyncOverride: childProcess.execSync,
  rmSyncOverride: fs.rmSync,
};

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
export function listChangedSubmodules(
  prFiles: string[],
  excludeGlobs: string[] = []
): string[] {
  const globs = excludeGlobs.map(glob => new mm.Minimatch(glob));
  // Not checking the top-level package.json
  let files = prFiles.filter(file =>
    file.match(/\/package\.json$|^package\.json$/)
  );
  for (const glob of globs) {
    files = files.filter(file => !glob.match(file));
  }
  const directories = new Set(files.map(x => dirname(x)));
  return Array.from(directories);
}

interface ExecutionOutput {
  output: string;
  error?: Error;
}
export function eachSubmodule(
  directories: string[],
  executor: (dir: string) => ExecutionOutput
): Record<string, ExecutionOutput> {
  const output: Record<string, ExecutionOutput> = {};
  for (const directory of directories) {
    output[directory] = executor(directory);
  }
  return output;
}

function publish(
  directory: string,
  dryRun: boolean,
  execSync: typeof childProcess.execSync,
  rmSync: typeof fs.rmSync
): ExecutionOutput {
  if (fs.existsSync(resolve(directory, 'package.json'))) {
    const pkg = JSON.parse(
      fs.readFileSync(resolve(directory, 'package.json'), 'utf-8')
    );
    if (pkg.private) {
      return {
        output: 'skipping publication ${directory}/package.json is private',
      };
    }
  }
  const installCommand = stat(resolve(directory, 'package-lock.json'))
    ? 'ci'
    : 'i';
  const output: string[] = [];
  try {
    // Install dependencies.
    output.push(
      execSync(`npm ${installCommand} --registry=https://registry.npmjs.org`, {
        cwd: directory,
        encoding: 'utf-8',
        stdio: 'inherit',
      })
    );

    // Pack a tarball and leave it behind so we can archive what we've
    // published.
    output.push(
      execSync('npm pack .', {
        cwd: directory,
        encoding: 'utf-8',
        stdio: 'inherit',
      })
    );

    // npm pack creates a tarball, but its name is unpredictable.  So we have to
    // find the most recent tarball in the directory and assume that's the one
    // created by npm pack.
    const tarball = findMostRecentTarBall(directory);

    // Publish the tarball to npmjs.org.
    output.push(
      execSync(
        `npm publish --access=public${dryRun ? ' --dry-run' : ''} ${tarball}`,
        {
          cwd: directory,
          encoding: 'utf-8',
          stdio: 'inherit',
        }
      )
    );

    // Clean out the node_modules directory.
    rmSync(join(directory, 'node_modules'), {
      recursive: true,
      force: true,
    });
  } catch (err) {
    console.log(err);
    return {
      output: output.join('\n'),
      error: err as Error,
    };
  }
  return {
    output: output.join('\n'),
  };
}

/// Finds the most recently created file in the directory with extension .tgz.
function findMostRecentTarBall(directory: string): string | undefined {
  return (
    fs
      // Collect tarballs.
      .readdirSync(directory)
      .filter(fname => fname.endsWith('.tgz'))
      // Lookup each tarball's creation time.
      .map(fname => {
        return {
          fname,
          stats: fs.statSync(join(directory, fname)),
        };
      })
      // Choose the tarball with the most recent creation time.
      .reduce((a, b) => (a.stats.ctimeMs > b.stats.ctimeMs ? a : b))?.fname
  );
}

export function publishSubmodules(directories: string[], dryRun: boolean) {
  console.log(`Directories to publish: ${directories}`);
  const execSync = methodOverrides.execSyncOverride || childProcess.execSync;
  const rmSync = methodOverrides.rmSyncOverride || fs.rmSync;
  const output = eachSubmodule(directories, directory => {
    return publish(directory, dryRun, execSync, rmSync);
  });

  // Collect any errors
  const errors: Error[] = [];
  for (const directory in output) {
    if (output[directory].error) {
      errors.push(output[directory].error!);
    }
  }
  return errors;
}

export function publishCustom(directories: string[], script: string) {
  console.log(`Directories to publish: ${directories}`);
  const execSync = methodOverrides.execSyncOverride || childProcess.execSync;
  const output = eachSubmodule(directories, directory => {
    try {
      return {
        output: execSync(script, {
          cwd: directory,
          encoding: 'utf-8',
          stdio: 'inherit',
        }),
      };
    } catch (err) {
      console.error(err);
      return {
        output: '',
        error: err as Error,
      };
    }
  });

  // Collect any errors
  const errors: Error[] = [];
  for (const directory in output) {
    if (output[directory].error) {
      errors.push(output[directory].error!);
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
