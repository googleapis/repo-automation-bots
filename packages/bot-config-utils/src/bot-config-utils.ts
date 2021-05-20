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

import Ajv from 'ajv';
import yaml from 'js-yaml';
import path from 'path';

import {Octokit} from '@octokit/rest';
import {logger} from 'gcf-utils';

type Conclusion =
  | 'success'
  | 'failure'
  | 'neutral'
  | 'cancelled'
  | 'timed_out'
  | 'action_required'
  | undefined;

export interface OctokitContext {
  octokit: Octokit;
}

export interface ValidateConfigResult {
  isValid: boolean;
  errorText: string | undefined;
}

interface File {
  content: string | undefined;
}

function isFile(file: File | unknown): file is File {
  return (file as File).content !== undefined;
}

export class ConfigChecker<T> {
  private ajv: Ajv;
  private schema: object;
  private configPath: string;
  private badConfigPaths: Array<string>;
  private configName: string;
  private config: T | null;
  constructor(schema: object, configFileName: string) {
    this.schema = schema;
    this.ajv = new Ajv();
    this.configPath = `.github/${configFileName}`;
    this.badConfigPaths = new Array<string>();
    this.config = null;
    const parsed = path.parse(this.configPath);
    if (parsed.ext === '.yml') {
      this.badConfigPaths.push(`${parsed.dir}/${parsed.name}.yaml`);
    } else if (parsed.ext === '.yaml') {
      this.badConfigPaths.push(`${parsed.dir}/${parsed.name}.yml`);
    }
    this.configName = parsed.name;
  }
  private async validateConfig(
    configYaml: string
  ): Promise<ValidateConfigResult> {
    const validateSchema = this.ajv.compile(this.schema);
    let isValid = false;
    let errorText: string | undefined;
    try {
      const config = yaml.load(configYaml) as unknown as T;
      isValid = validateSchema(config);
      if (!isValid) {
        errorText = JSON.stringify(validateSchema.errors, null, 4);
      } else {
        this.config = config;
      }
    } catch (err) {
      // failed to load the yaml file
      errorText =
        `.github/${this.configPath} is not valid YAML 😱 \n` + err.message;
    }
    return {isValid: isValid, errorText: errorText};
  }

  public getConfig(): T | null {
    return this.config;
  }

  public async validateConfigChanges(
    octokit: Octokit,
    owner: string,
    repo: string,
    commitSha: string,
    prNumber: number
  ): Promise<void> {
    const listFilesParams = {
      owner: owner,
      repo: repo,
      pull_number: prNumber,
      per_page: 100,
    };
    let errorText = '';
    const files = await octokit.paginate(
      octokit.pulls.listFiles,
      listFilesParams
    );
    for (const file of files) {
      if (file.status === 'removed') {
        continue;
      }
      logger.debug(`file: ${file.filename}`);
      if (this.badConfigPaths.indexOf(file.filename) > -1) {
        // Trying to add a config file with a wrong file extension.
        errorText +=
          `You tried to add ${file.filename}, ` +
          `but the config file must be ${this.configPath}\n`;
      }
      if (file.filename === this.configPath) {
        const blob = await octokit.git.getBlob({
          owner: owner,
          repo: repo,
          file_sha: file.sha,
        });
        const fileContents = Buffer.from(blob.data.content, 'base64').toString(
          'utf8'
        );
        const result = await this.validateConfig(fileContents);
        if (!result.isValid) {
          errorText += result.errorText;
        }
      }
      if (errorText !== '') {
        const checkParams = {
          owner: owner,
          repo: repo,
          name: `${this.configName} config schema`,
          conclusion: 'failure' as Conclusion,
          head_sha: commitSha,
          output: {
            title: 'Config schema error',
            summary: 'An error found in the config file',
            text: errorText,
          },
        };
        await octokit.checks.create(checkParams);
      }
    }
  }
}

export async function getConfig<T>(
  octokit: Octokit,
  owner: string,
  repo: string,
  fileName: string
): Promise<T | null> {
  const path = `.github/${fileName}`;
  try {
    const resp = await octokit.repos.getContent({
      owner: owner,
      repo: repo,
      path: path,
    });
    if (isFile(resp.data)) {
      const loaded =
        yaml.load(
          Buffer.from(resp.data.content.toString(), 'base64').toString()
        ) || {};
      return Object.assign({}, undefined, loaded);
    } else {
      // This should not happen.
      throw new Error('could not handle getContent result.');
    }
  } catch (err) {
    if (err.status === 404 && repo !== '.github') {
      // Try to get it from the `.github` repo.
      try {
        const resp = await octokit.repos.getContent({
          owner: owner,
          repo: '.github',
          path: path,
        });
        if (isFile(resp.data)) {
          const loaded =
            yaml.load(
              Buffer.from(resp.data.content.toString(), 'base64').toString()
            ) || {};
          return Object.assign({}, undefined, loaded);
        } else {
          // This should not happen.
          throw new Error('could not handle getContent result.');
        }
      } catch (err) {
        if (err.status === 404) {
          return null;
        } else {
          throw err;
        }
      }
    } else {
      throw err;
    }
  }
}

export async function getConfigWithDefault<T>(
  octokit: Octokit,
  owner: string,
  repo: string,
  fileName: string,
  defaultConfig: T
): Promise<T> {
  const path = `.github/${fileName}`;
  try {
    const resp = await octokit.repos.getContent({
      owner: owner,
      repo: repo,
      path: path,
    });
    if (isFile(resp.data)) {
      const loaded =
        yaml.load(
          Buffer.from(resp.data.content.toString(), 'base64').toString()
        ) || {};
      return Object.assign({}, defaultConfig, loaded);
    } else {
      // This should not happen.
      throw new Error('could not handle getContent result.');
    }
  } catch (err) {
    if (err.status === 404 && repo !== '.github') {
      // Try to get it from the `.github` repo.
      try {
        const resp = await octokit.repos.getContent({
          owner: owner,
          repo: '.github',
          path: path,
        });
        if (isFile(resp.data)) {
          const loaded =
            yaml.load(
              Buffer.from(resp.data.content.toString(), 'base64').toString()
            ) || {};
          return Object.assign({}, defaultConfig, loaded);
        } else {
          // This should not happen.
          throw new Error('could not handle getContent result.');
        }
      } catch (err) {
        if (err.status === 404) {
          return defaultConfig;
        } else {
          throw err;
        }
      }
    } else {
      throw err;
    }
  }
}
