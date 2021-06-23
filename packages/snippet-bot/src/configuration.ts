// Copyright 2020 Google LLC
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

import * as minimatch from 'minimatch';

export interface ConfigurationOptions {
  ignoreFiles: string[];
  alwaysCreateStatusCheck: boolean;
  aggregateChecks: boolean;
}

export const DEFAULT_CONFIGURATION: ConfigurationOptions = {
  ignoreFiles: [],
  alwaysCreateStatusCheck: false,
  aggregateChecks: true,
};

export const CONFIGURATION_FILE_PATH = 'snippet-bot.yml';

export class Configuration {
  private options: ConfigurationOptions;
  private minimatches: minimatch.IMinimatch[];

  constructor(options: ConfigurationOptions) {
    this.options = options;
    this.minimatches = options.ignoreFiles.map(pattern => {
      return new minimatch.Minimatch(pattern);
    });
  }

  ignoredFile(filename: string): boolean {
    return this.minimatches.some(mm => {
      return mm.match(filename);
    });
  }
  alwaysCreateStatusCheck(): boolean {
    return this.options.alwaysCreateStatusCheck;
  }
  aggregateChecks(): boolean {
    return this.options.aggregateChecks;
  }
}
