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
import * as proc from 'child_process';
import {Logger} from './logger';

// Creates a function that first prints, then executes a shell command.
export type Cmd = (
  command: string,
  options?: proc.ExecSyncOptions | undefined
) => Buffer;

export function newCmd(logger: Logger = console): Cmd {
  const cmd = (
    command: string,
    options?: proc.ExecSyncOptions | undefined
  ): Buffer => {
    logger.info(command);
    const output = proc.execSync(command, options);
    if (typeof output === 'string') return Buffer.from(output);
    else return output;
  };
  return cmd;
}
