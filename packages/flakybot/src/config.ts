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

import {Context} from 'probot';
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

export class ConfigChecker<T> {
  private ajv: Ajv;
  private schema: object;
  private configPath: string;
  private badConfigPaths: Array<string>;
  private configName: string;
  constructor(schema: object, configFileName: string) {
    this.schema = schema;
    this.ajv = new Ajv();
    this.configPath = `.github/${configFileName}`;
    this.badConfigPaths = new Array<string>();
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
    const config = (yaml.load(configYaml) as unknown) as T;
    let isValid = false;
    let errorText: string | undefined;
    if (typeof config === 'object') {
      isValid = validateSchema(config);
      if (!isValid) {
        errorText = JSON.stringify(validateSchema.errors, null, 4);
      }
    } else {
      errorText = `.github/${this.configPath} is not valid YAML 😱`;
    }
    return {isValid: isValid, errorText: errorText};
  }

  public async validateConfigChanges(context: Context): Promise<void> {
    const listFilesParams = context.repo({
      pull_number: context.payload.pull_request.number,
      per_page: 100,
    });
    const pullRequestCommitSha = context.payload.pull_request.head.sha;
    try {
      let errorText = '';
      const files = await context.octokit.paginate(
        context.octokit.pulls.listFiles,
        listFilesParams
      );
      for (let i = 0; files[i] !== undefined; i++) {
        const file = files[i];
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
          const blob = await context.octokit.git.getBlob(
            context.repo({
              file_sha: file.sha,
            })
          );
          const fileContents = Buffer.from(
            blob.data.content,
            'base64'
          ).toString('utf8');
          const result = await this.validateConfig(fileContents);
          if (!result.isValid) {
            errorText += result.errorText;
          }
        }
        if (errorText !== '') {
          const checkParams = context.repo({
            name: `${this.configName} config schema`,
            conclusion: 'failure' as Conclusion,
            head_sha: pullRequestCommitSha,
            output: {
              title: 'Config schema error',
              summary: 'An error found in the config file',
              text: errorText,
            },
          });
          await context.octokit.checks.create(checkParams);
        }
      }
    } catch (err) {
      logger.error(err);
      return;
    }
  }
}

export async function getConfig<T>(
  context: OctokitContext,
  owner: string,
  repo: string,
  fileName: string,
  defaultConfig?: T
): Promise<T | null> {
  const path = `.github/${fileName}`;
  try {
    const resp = await context.octokit.repos.getContent({
      owner: owner,
      repo: repo,
      path: path,
    });
    const loaded =
      yaml.load(Buffer.from(resp.data.toString(), 'base64').toString()) || {};
    return Object.assign({}, defaultConfig, loaded);
  } catch (err) {
    if (err.status === 404 && repo !== '.github') {
      // Try to get it from the `.github` repo.
      try {
        const resp = await context.octokit.repos.getContent({
          owner: owner,
          repo: '.github',
          path: path,
        });
        const loaded =
          yaml.load(Buffer.from(resp.data.toString(), 'base64').toString()) ||
          {};
        return Object.assign({}, defaultConfig, loaded);
      } catch (err) {
        if (err.status === 404) {
          if (defaultConfig) {
            return defaultConfig;
          } else {
            return null;
          }
        } else {
          throw err;
        }
      }
    } else {
      throw err;
    }
  }
}
