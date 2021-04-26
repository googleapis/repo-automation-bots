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

import {RepoConfig} from './types';
import {Octokit} from '@octokit/rest';
import {logger} from 'gcf-utils';
import Ajv from 'ajv';
import yaml from 'js-yaml';
import schema from './schema.json';

// configure the schema validator once
const ajv = new Ajv();
const validateSchema = ajv.compile(schema);

export const configFileName = 'sync-repo-settings.yaml';

export interface GetConfigOptions {
  octokit: Octokit;
  owner: string;
  repo: string;
}

export interface ValidateConfigResponse {
  isValid: boolean;
  errorText?: string;
  config?: RepoConfig;
}

/**
 * Given a config in its raw yaml form, validate that it matches our config
 * schema.  Return any validation errors from ajv.
 * @param configYaml Raw text containing the YAML to validate.
 * @returns
 */
export async function validateConfig(configYaml: string) {
  const config = yaml.load(configYaml) as RepoConfig;
  let isValid = false;
  let errorText = '';
  if (typeof config === 'object') {
    isValid = await validateSchema(config);
    errorText = JSON.stringify(validateSchema.errors, null, 4);
  } else {
    errorText = `${configFileName} is not valid YAML 😱`;
  }
  return {isValid, errorText, config};
}

/**
 * Allow repositories to optionally provide their own, localized config.
 * Check the `.github/sync-repo-settings.yaml` file, and if available,
 * use that config over any config broadly provided here.
 */
export async function getConfig(
  options: GetConfigOptions
): Promise<RepoConfig | null> {
  let config!: RepoConfig | null;
  try {
    config = await getConfigFile(options);
  } catch (err) {
    err.message = `Error reading configuration: ${err.message}`;
    logger.error(err);
  }
  if (!config) {
    try {
      // if there is no local config, check the upstream .github repo
      config = await getConfigFile({
        octokit: options.octokit,
        owner: options.owner,
        repo: '.github',
      });
    } catch (err) {
      err.message = `Error reading org level config ${err.message}`;
      logger.error(err);
    }
  }
  return config;
}

/**
 * For a given repository, fetch the config yaml.
 * @param options GetConfigOptions
 * @returns an individual Repo config
 */
async function getConfigFile(
  options: GetConfigOptions
): Promise<RepoConfig | null> {
  const orgYamlRes = await options.octokit.repos.getContent({
    owner: options.owner,
    repo: options.repo,
    path: `.github/${configFileName}`,
    headers: {
      accept: 'application/vnd.github.VERSION.raw',
    },
  });
  const rawYamlConfig = orgYamlRes.data.toString();
  const orgConfig = yaml.load(rawYamlConfig);
  return orgConfig as RepoConfig;
}
