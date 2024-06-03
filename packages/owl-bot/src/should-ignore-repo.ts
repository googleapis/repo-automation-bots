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

/**
 * Some repos should be ignored even though they may contain an
 * .OwlBot.yaml.
 *
 * Looks for the environment variable IGNORE_REPO_REGEXP, and falls back to
 * a default ignore regexp if it doesn't find one.  An environment variable
 * works better than a command line flag in this case because multiple
 * commands need to ignore the same set of repos.
 *
 * @param ownerSlashRepo the full the name of the github repo.
 *  ex: 'googleapis/nodejs-asset'
 */
export function shouldIgnoreRepo(ownerSlashRepo: string): boolean {
  // By default, ignore 'googleapis' and 'googleapis-gen' because they
  // don't contain .OwlBot.yaml files and their huge and downloading them
  // is a waste of time and energy.
  // Also, ignore PHP's mirrored repos because their exact copies of
  // subdirectories of google-cloud-php and never accept pull requests.
  const regexp = process.env.IGNORE_REPO_REGEXP
    ? new RegExp(process.env.IGNORE_REPO_REGEXP)
    : /googleapis\/(googleapis(-gen)?|google-cloud-php-.+|php-.+)/;
  return regexp.test(ownerSlashRepo);
}
