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
import {OwlBotLock} from './config-files';
import {collectConfigs, OwlBotYamlAndPath} from './configs-store';
import * as fs from 'fs';
import path from 'path';

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
): Promise<[OwlBotLock | undefined, OwlBotYamlAndPath[]]> {
  const response = await octokit.repos.downloadZipballArchive(githubRepo);

  const tmpDir = tmp.dirSync().name;
  try {
    const zip = new AdmZip(Buffer.from(response.data as ArrayBuffer));
    zip.extractAllTo(tmpDir);

    // The root directory of the zip is <repo-name>-<short-hash>.
    // That's actually the directory we want to work in.
    const [rootDir] = fs.readdirSync(tmpDir);

    return collectConfigs(path.join(tmpDir, rootDir));
  } finally {
    // When running in cloud functions, space is limited, so clean up.
    fs.rmdirSync(tmpDir, {recursive: true});
  }
}
