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

import {GCFLogger, logger as defaultLogger} from 'gcf-utils';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface Annotation {
  name: string;
  file: string;
  line: number;
  preview: string;
  context?: string;
}

interface ScannerOptions {
  logger?: GCFLogger;
  workdir?: string;
}

export class AnnotationScanner {
  readonly owner: string;
  readonly repo: string;
  readonly branch: string;
  private logger: GCFLogger;
  private workdir?: string;

  constructor(
    owner: string,
    repo: string,
    branch: string,
    options?: ScannerOptions
  ) {
    this.owner = owner;
    this.repo = repo;
    this.branch = branch;
    this.logger = options?.logger ?? defaultLogger;
    this.workdir = options?.workdir;
  }

  private async getWorkdir(): Promise<string> {
    if (!this.workdir) {
      this.workdir = fs.mkdtempSync(
        path.join(os.tmpdir(), `${this.owner}-${this.repo}`)
      );
      this.logger.info(
        `Cloning ${this.owner}/${this.repo} (${this.branch}) into ${this.workdir}`
      );
      await exec(
        `git clone --depth=1 --branch=${this.branch} https://github.com/${this.owner}/${this.repo}.git ${this.workdir}`,
        {logger: this.logger}
      );
    }
    return this.workdir;
  }

  // TODO: example todo
  // TODO(context): another example annotation
  async findAnnotations(annotations: string[]): Promise<Annotation[]> {
    const foundAnnotations: Annotation[] = [];
    const workdir = await this.getWorkdir();
    for (const annotation of annotations) {
      const contextMatcher = new RegExp(
        `${annotation}(?:\\((?<context>.*)\\))?:`
      );
      const {stdout} = await exec(`grep -rn -E '${annotation}(\\(.*\\))?:'`, {
        cwd: workdir,
      });
      for (const line of stdout.split('\n')) {
        const [file, lineNumber, ...rest] = line.split(':');
        if (file) {
          const content = rest.join(':');
          const match = content.match(contextMatcher);
          foundAnnotations.push({
            name: annotation,
            file,
            line: Number(lineNumber),
            preview: content.substring(0, 128),
            context: match?.groups?.context,
          });
        }
      }
    }
    return foundAnnotations;
  }
}

interface ExecOptions {
  logger?: GCFLogger;
  cwd?: string;
}

function exec(
  command: string,
  options?: ExecOptions
): Promise<{stdout: string; stderr: string; error?: Error}> {
  const logger = options?.logger;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return new Promise((resolve, _reject) => {
    child_process.exec(
      command,
      {
        env: process.env,
        cwd: options?.cwd,
      },
      (error, stdout, stderr) => {
        if (logger) {
          if (stdout) {
            logger.info(stdout);
          }
          if (stderr) {
            logger.warn(stderr);
          }
        }
        resolve({stdout, stderr, error: error || undefined});
      }
    );
  });
}
