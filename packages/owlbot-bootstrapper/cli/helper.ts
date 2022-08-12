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

import {CliArgs} from './run-trigger-command';
import {execSync} from 'child_process';

export class Helper {
  args: CliArgs;
  languageContainers: {
    language: string;
    languageContainer: string;
    repoToClone: string;
  }[];

  constructor(args: CliArgs) {
    this.args = args;
    this.languageContainers = [
      {
        language: 'nodejs',
        languageContainer: 'gcr.io/owlbot-bootstrap-prod/node-bootstrapper',
        repoToClone: 'git@github.com/googleapis/google-cloud-node.git',
      },
    ];
  }

  public async getLanguageSpecificValues() {
    for (const languageContainer of this.languageContainers) {
      if (languageContainer.language === this.args['language']) {
        languageContainer.languageContainer =
          await this.getFullLatestContainerName(
            languageContainer.languageContainer
          );
        return languageContainer;
      }
    }

    // If there was never a match, and there was no language container specified in the CLI, we should throw
    if (!this.args['languageContainer']) {
      throw new Error('No language-specific container specified.');
    }

    return undefined;
  }

  public async getFullLatestContainerName(container: string) {
    const latestSha = Buffer.from(
      execSync(
        `gcloud container images describe ${container} --format="value(image_summary.digest)"`
      )
    )
      .toString('utf-8')
      .trim();

    return `${container}@${latestSha}`;
  }
}
