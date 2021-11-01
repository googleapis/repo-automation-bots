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

import AdmZip from 'adm-zip';
import {OctokitType} from './octokit-util';
import tmp from 'tmp';
import {collectConfigs, CollectedConfigs} from './configs-store';
import * as fs from 'fs';
import path from 'path';
import {newCmd} from './cmd';

/**
 * Fetches the configuration files from a github repo.
 */
export async function fetchConfigs(
  octokit: OctokitType,
  githubRepo: {
    owner: string;
    repo: string;
    ref: string;
  }
): Promise<CollectedConfigs> {
  const cmd = newCmd();

  const tmpDir = tmp.dirSync({keep: true}).name;
  try {
    // Frustratingly, there's no way to clone a repo at a particular ref.
    // We observed the ref milliseconds ago, so it should be in the most recent 10
    // commits for sure.  If not, then we'll catch it again the next time
    // scan-configs runs.
    cmd(
      `git clone --depth 10 https://github.com/${githubRepo.owner}/${githubRepo.repo}.git`,
      {cwd: tmpDir}
    );
    const repoDir = path.join(tmpDir, githubRepo.repo);
    cmd(`git checkout ${githubRepo.ref}`, {cwd: repoDir});
    return collectConfigs(repoDir);
  } finally {
    // When running in cloud functions, space is limited, so clean up.
    fs.rmdirSync(tmpDir, {recursive: true});
  }
}
