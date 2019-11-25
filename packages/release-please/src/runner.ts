// Copyright 2019 Google LLC
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

// TODO: fix these imports when release-please exports types from the root
import { ReleasePR } from 'release-please/build/src/release-pr';
import { GitHubRelease } from 'release-please/build/src/github-release';

export class Runner {
  static runner = (pr: ReleasePR) => {
    pr.run();
  };
  static releaser = (release: GitHubRelease) => {
    release.createRelease();
  };
}
