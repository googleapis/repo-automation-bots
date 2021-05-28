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

/**
 * This interface is used for comforting typescript's type system to
 * deal with the response from `octokit.repos.getContent`.
 */
interface File {
  content: string | undefined;
}

/**
 * This function is used for comforting typescript's type system to
 * deal with the response from `octokit.repos.getContent`.
 */
function isFile(file: File | unknown): file is File {
  return (file as File).content !== undefined;
}

/**
 * The return value of `validateConfig` function.
 *
 * @template ConfigType
 * @prop {boolean} isValid - The result of the schema validation.
 * @prop {string} errorText - The error message from the validation.
 * @prop {ConfigType} config - The loaded config object,only available
 *   when the validation succeeds.
 */
export interface ValidateConfigResult<ConfigType> {
  isValid: boolean;
  errorText: string | undefined;
  config?: ConfigType;
}

/**
 * The optionnal arguments for `validateConfig`.
 *
 * @prop {Array<object>} additionalSchemas - Additional schemas for Ajv schema
 *   validator. When you have complex schema that used definition in different
 *   files, you need to give all the schema definitions to Ajv.
 */
export interface ValidateConfigOptions {
  additionalSchemas?: Array<object>;
}

/**
 * It loads the given string as yaml, then validates against the given schema.
 *
 * @template ConfigType
 * @param {string} configYaml - The string representation of the config.
 * @param {object} schema - The schema definition.
 * @param {ValidateConfigOptions} options - Optional arguments for validation.
 *
 * @return {ValidateConfigResult<ConfigType>}
 */
export function validateConfig<ConfigType>(
  configYaml: string,
  schema: object,
  options: ValidateConfigOptions
): ValidateConfigResult<ConfigType> {
  const ajv = new Ajv();
  if (options.additionalSchemas) {
    for (const schema of options.additionalSchemas) {
      ajv.addSchema(schema);
    }
  }
  const validateSchema = ajv.compile(schema);
  let isValid = false;
  let errorText: string | undefined;
  let config: ConfigType | undefined;
  try {
    const candidate = yaml.load(configYaml) as unknown as ConfigType;
    isValid = validateSchema(candidate);
    if (isValid) {
      config = candidate;
    } else {
      errorText = JSON.stringify(validateSchema.errors, null, 4);
    }
  } catch (err) {
    // failed to load the yaml file
    errorText = 'the given config is not valid YAML 😱 \n' + err.message;
  }
  return {isValid: isValid, errorText: errorText, config: config};
}

/**
 * A class for validating the config changes on pull requests.
 *
 * @template ConfigType
 */
export class ConfigChecker<ConfigType> {
  private schema: object;
  private additionalSchemas: Array<object>;
  private configPath: string;
  private badConfigPaths: Array<string>;
  private configName: string;
  private config: ConfigType | null;
  constructor(
    schema: object,
    configFileName: string,
    additionalSchemas: Array<object> = []
  ) {
    this.schema = schema;
    this.additionalSchemas = additionalSchemas;
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

  /**
   * A function for getting the config object validated by Ajv.
   *
   * @return {ConfigType | null} When the validation fails, it returns null.
   */
  public getConfig(): ConfigType | null {
    return this.config;
  }

  /**
   * A function for validate the config file against given schema. It
   * will create a failing Github Check on the commit when validation fails.
   *
   * @param {Octokit} octokit - Authenticated octokit object.
   * @param {string} owner - The owner of the base repository of the PR.
   * @param {string} repo - The name of the base repository of the PR.
   * @param {string} commitSha - The commit hash of the tip of the PR head.
   * @param {number} prNumber - The number of the PR.
   *
   * @return {Promise<void>}
   */
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
        const result = validateConfig<ConfigType>(fileContents, this.schema, {
          additionalSchemas: this.additionalSchemas,
        });
        if (result.isValid) {
          this.config = result.config as ConfigType;
        } else {
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

/**
 * Optional arguments to `getConfig` and `getConfigWithDefault`.
 *
 * @param {boolean} fallbackToOrgConfig - If set to true, it will try to fetch
 *   the config from `.github` repo in the same org, defaults to true.
 * @param {string} branch - The branch for getting the config.
 * @param {object} schema - The json schema definition.
 * @param {Array<object>} additionalSchemas - Additional schema definitions.
 */
export interface getConfigOptions {
  fallbackToOrgConfig?: boolean;
  branch?: string;
  schema?: object;
  additionalSchemas?: Array<object>;
}

/**
 * The default set of values of `getConfigOptions`.
 */
const DEFAULT_GET_CONFIG_OPTIONS = {
  fallbackToOrgConfig: true,
};

/**
 * A function for fetching config file from the repo. It falls back to
 * `.github` repository by default.
 *
 * @template ConfigType
 * @param {Octokit} octokit - Authenticated octokit object.
 * @param {string} owner - The owner of the repository.
 * @param {string} repo - The name of the repository.
 * @param {string} fileName - The filename of the config file.
 * @param {getConfigOptions} options - Optional arguments.
 *
 * @return {Promise<ConfigType | null>} - It returns null when config is not
 *   found.
 */
export async function getConfig<ConfigType>(
  octokit: Octokit,
  owner: string,
  repo: string,
  fileName: string,
  options?: getConfigOptions
): Promise<ConfigType | null> {
  // Fill the option with the default values
  options = {...DEFAULT_GET_CONFIG_OPTIONS, ...options};
  const path = `.github/${fileName}`;
  const params = options.branch
    ? {
        owner: owner,
        repo: repo,
        path: path,
        ref: options.branch,
      }
    : {
        owner: owner,
        repo: repo,
        path: path,
      };
  try {
    const resp = await octokit.repos.getContent(params);
    if (isFile(resp.data)) {
      const loaded =
        yaml.load(Buffer.from(resp.data.content, 'base64').toString()) || {};
      if (!options.schema) {
        return Object.assign({}, undefined, loaded);
      }
      const validateResult = validateConfig<ConfigType>(
        Buffer.from(resp.data.content, 'base64').toString('utf-8'),
        options.schema,
        {additionalSchemas: options.additionalSchemas}
      );
      if (validateResult.config) {
        return validateResult.config;
      } else {
        throw new Error(
          `Failed to validate the config schema at '${path}' ` +
            `:${validateResult.errorText}`
        );
      }
    } else {
      // This should not happen.
      throw new Error('could not handle getContent result.');
    }
  } catch (err) {
    if (err.status !== 404) {
      // re-throw all the non 404 errors
      throw err;
    }
    if (repo === '.github' || !options.fallbackToOrgConfig || options.branch) {
      // Already fetched from the '.github' repo, fallbackToOrgConfig
      // is false, or branch is specified, it returns null.
      return null;
    }
    // Try to get it from the `.github` repo.
    try {
      const resp = await octokit.repos.getContent({
        owner: owner,
        repo: '.github',
        path: path,
      });
      if (isFile(resp.data)) {
        const loaded =
          yaml.load(Buffer.from(resp.data.content, 'base64').toString()) || {};
        if (!options.schema) {
          return Object.assign({}, undefined, loaded);
        }
        const validateResult = validateConfig<ConfigType>(
          Buffer.from(resp.data.content, 'base64').toString('utf-8'),
          options.schema,
          {additionalSchemas: options.additionalSchemas}
        );
        if (validateResult.config) {
          return validateResult.config;
        } else {
          throw new Error(
            `Failed to validate the config schema at '${path}' ` +
              `:${validateResult.errorText}`
          );
        }
      } else {
        // This should not happen.
        throw new Error('could not handle getContent result.');
      }
    } catch (err) {
      if (err.status !== 404) {
        throw err;
      }
      return null;
    }
  }
}

/**
 * A function for fetching config file from the repo. It falls back to
 * `.github` repository by default.
 *
 * @template ConfigType
 * @param {Octokit} octokit - Authenticated octokit object.
 * @param {string} owner - The owner of the repository.
 * @param {string} repo - The name of the repository.
 * @param {string} fileName - The filename of the config file.
 * @param {ConfigType} defaultConfig - This can be used for filling the default
 *   value of the config.
 * @param {getConfigOptions} options - Optional arguments.
 *
 * @return {Promise<ConfigType>} - It returns the given defaultConfig when
 *   config file is not found.
 */
export async function getConfigWithDefault<ConfigType>(
  octokit: Octokit,
  owner: string,
  repo: string,
  fileName: string,
  defaultConfig: ConfigType,
  options?: getConfigOptions
): Promise<ConfigType> {
  // Fill the option with the default values
  options = {...DEFAULT_GET_CONFIG_OPTIONS, ...options};
  const path = `.github/${fileName}`;
  const params = options.branch
    ? {
        owner: owner,
        repo: repo,
        path: path,
        ref: options.branch,
      }
    : {
        owner: owner,
        repo: repo,
        path: path,
      };
  try {
    const resp = await octokit.repos.getContent(params);
    if (isFile(resp.data)) {
      const loaded =
        yaml.load(Buffer.from(resp.data.content, 'base64').toString()) || {};
      if (!options.schema) {
        return Object.assign({}, defaultConfig, loaded);
      }
      const validateResult = validateConfig<ConfigType>(
        Buffer.from(resp.data.content, 'base64').toString('utf-8'),
        options.schema,
        {additionalSchemas: options.additionalSchemas}
      );
      if (validateResult.config) {
        return {...defaultConfig, ...validateResult.config};
      } else {
        throw new Error(
          `Failed to validate the config schema at '${path}' ` +
            `:${validateResult.errorText}`
        );
      }
    } else {
      // This should not happen.
      throw new Error('could not handle getContent result.');
    }
  } catch (err) {
    if (err.status !== 404) {
      throw err;
    }
    if (repo === '.github' || !options.fallbackToOrgConfig || options.branch) {
      // Already fetched from the '.github' repo, fallbackToOrgConfig
      // is false, or branch is specified, it returns the default.
      return defaultConfig;
    }
    // Try to get it from the `.github` repo.
    try {
      const resp = await octokit.repos.getContent({
        owner: owner,
        repo: '.github',
        path: path,
      });
      if (isFile(resp.data)) {
        const loaded =
          yaml.load(Buffer.from(resp.data.content, 'base64').toString()) || {};
        if (!options.schema) {
          return Object.assign({}, defaultConfig, loaded);
        }
        const validateResult = validateConfig<ConfigType>(
          Buffer.from(resp.data.content, 'base64').toString('utf-8'),
          options.schema,
          {additionalSchemas: options.additionalSchemas}
        );
        if (validateResult.config) {
          return {...defaultConfig, ...validateResult.config};
        } else {
          throw new Error(
            `Failed to validate the config schema at '${path}' ` +
              `:${validateResult.errorText}`
          );
        }
      } else {
        // This should not happen.
        throw new Error('could not handle getContent result.');
      }
    } catch (err) {
      if (err.status !== 404) {
        throw err;
      }
      return defaultConfig;
    }
  }
}
