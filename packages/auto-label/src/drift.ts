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

import {logger} from 'gcf-utils';
import {Storage} from '@google-cloud/storage';

export interface DriftApi {
  github_label: string;
}

export interface DriftRepo {
  github_label: string;
  repo: string;
}

const storage = new Storage();

export async function getDriftFile(file: string) {
  const bucket = 'devrel-prod-settings';
  const [contents] = await storage.bucket(bucket).file(file).download();
  return contents.toString();
}

export async function getDriftRepos(): Promise<DriftRepo[]> {
  const jsonData = await getDriftFile('public_repos.json');
  if (!jsonData) {
    logger.warn('public_repos.json downloaded from Cloud Storage was empty');
    return [];
  }
  return JSON.parse(jsonData).repos as DriftRepo[];
}

export async function getDriftApis(): Promise<DriftApi[]> {
  const jsonData = await getDriftFile('apis.json');
  if (!jsonData) {
    logger.warn('apis.json downloaded from Cloud Storage was empty');
    return [];
  }
  return JSON.parse(jsonData).apis as DriftApi[];
}

export async function getDriftRepo(
  owner: string,
  repo: string
): Promise<DriftRepo | undefined> {
  const driftRepos = await getDriftRepos();
  return driftRepos.find(x => x.repo === `${owner}/${repo}`);
}
