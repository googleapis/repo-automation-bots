// Copyright 2020 Google LLC
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
//

import * as yaml from 'yaml';
import {resolve} from 'path';
import * as fs from 'fs';

export interface Config {
  firestore: {
    project_id: string;
  };
  task_queue_processor: {
    task_queue_project_id: string;
    task_queue_location: string;
  };
}

export class ConfigUtil {
  private static DEFAULT_CONFIG_PATH = resolve('./config/config.yml');
  private static configs: {[path: string]: Config} = {};

  public static getConfig(path?: string): Config {
    path = path ?? this.DEFAULT_CONFIG_PATH;
    if (!this.configs[path]) {
      try {
        const configFile = fs.readFileSync(path, 'utf-8');
        this.configs[path] = yaml.parse(configFile) as Config;
      } catch (e) {
        throw new Error(`Failed to read config file: ${e}`);
      }
    }
    return this.configs[path];
  }
}
