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
import addFormats from 'ajv-formats';
import yaml from 'js-yaml';
import path from 'path';
import {RequestError} from '@octokit/types';

// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
import {logger as defaultLogger, GCFLogger} from 'gcf-utils';

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
 * The optional arguments for `validateConfig`.
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
  let candidate: ConfigType;
  try {
    // When the config file is empty, the result of `yaml.load` is
    // undefined. We use an empty object in that case because bot
    // config is usually an object.
    // Note: Bot must use `object` config if it wants to handle an
    // empty config file.
    candidate = (yaml.load(configYaml) || {}) as ConfigType;
  } catch (e) {
    const err = e as Error;
    // failed to load the yaml file
    return {
      isValid: false,
      errorText: 'the given config is not valid YAML 😱 \n' + err.message,
    };
  }
  return validateObject<ConfigType>(candidate, schema, options);
}

function validateObject<ConfigType>(
  config: ConfigType,
  schema: object,
  options: ValidateConfigOptions
): ValidateConfigResult<ConfigType> {
  const ajv = new Ajv();
  addFormats(ajv);
  if (options.additionalSchemas) {
    for (const schema of options.additionalSchemas) {
      ajv.addSchema(schema);
    }
  }
  const validateSchema = ajv.compile(schema);
  let errorText: string | undefined;
  const isValid = validateSchema(config);
  if (!isValid) {
    errorText = JSON.stringify(validateSchema.errors, null, 4);
    return {isValid, errorText};
  }
  return {isValid, errorText, config};
}

async function validateFile<ConfigType>(
  octokit: Octokit,
  owner: string,
  repo: string,
  fileSha: string,
  filename: string,
  schema: object,
  options: ValidateConfigOptions
): Promise<ValidateConfigResult<ConfigType>> {
  const blob = await octokit.git.getBlob({
    owner: owner,
    repo: repo,
    file_sha: fileSha,
  });
  const fileContents = Buffer.from(blob.data.content, 'base64').toString(
    'utf8'
  );
  let candidate: ConfigType;
  const parsedFile = path.parse(filename);
  switch (parsedFile.ext) {
    case '.json':
      try {
        candidate = JSON.parse(fileContents) as ConfigType;
      } catch (e) {
        const err = e as Error;
        // failed to load the yaml file
        return {
          isValid: false,
          errorText: `the given config is not valid JSON 😱 \n${err.message}`,
        };
      }
      break;
    case '.yaml':
    case '.yml':
      try {
        // When the config file is empty, the result of `yaml.load` is
        // undefined. We use an empty object in that case because bot
        // config is usually an object.
        // Note: Bot must use `object` config if it wants to handle an
        // empty config file.
        candidate = (yaml.load(fileContents) || {}) as ConfigType;
      } catch (e) {
        const err = e as Error;
        // failed to load the yaml file
        return {
          isValid: false,
          errorText: `the given config is not valid YAML 😱 \n${err.message}`,
        };
      }
      break;
    default:
      return {
        isValid: false,
        errorText: `unknown file type: ${filename}`,
      };
  }

  return validateObject<ConfigType>(candidate, schema, options);
}

/**
 * A class for validating the config changes on pull requests.
 *
 * @template ConfigType
 */
export class ConfigChecker<ConfigType> {
  private configPath: string;
  private checker: MultiConfigChecker;
  constructor(
    schema: object,
    configFileName: string,
    additionalSchemas: Array<object> = []
  ) {
    this.configPath = `.github/${configFileName}`;
    const config: Record<string, object> = {};
    config[this.configPath] = schema;
    const additionalConfig: Record<string, object[]> = {};
    additionalConfig[this.configPath] = additionalSchemas;
    this.checker = new MultiConfigChecker(config, additionalConfig);
  }

  /**
   * A function for getting the config object validated by Ajv.
   *
   * @return {ConfigType | null} When the validation fails, it returns null.
   */
  public getConfig(): ConfigType | null {
    const config = this.checker.getConfig(this.configPath);
    if (config) {
      return config as unknown as ConfigType;
    }
    return null;
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
   * @return {Promise<boolean>} Returns 'true' if config is valid, 'false' if invalid.
   */
  public async validateConfigChanges(
    octokit: Octokit,
    owner: string,
    repo: string,
    commitSha: string,
    prNumber: number,
    logger: GCFLogger = defaultLogger
  ): Promise<boolean> {
    return await this.checker.validateConfigChanges(
      octokit,
      owner,
      repo,
      commitSha,
      prNumber,
      logger
    );
  }
}

/**
 * A class for validating multiple config file changes on pull requests.
 * It validates both the schema and common file extension mismatches (e.g.
 * yaml <-> yml).
 */
export class MultiConfigChecker {
  private schemasByFile: Record<string, object>;
  private additionalSchemasByFile: Record<string, object[]>;
  private configNamesByFile: Record<string, string>;
  private badConfigFiles: Record<string, string>;
  private parsedConfigs: Record<string, object>;

  /**
   * Instantiate a new MultiConfigChecker
   *
   * @param {Record<string, object>} schemasByFile JSON schemas indexed by filename
   * @param {Record<string, object[]>} additionalSchemasByFile Additional JSON schemas indexed by filename
   */
  constructor(
    schemasByFile: Record<string, object>,
    additionalSchemasByFile: Record<string, object[]> = {}
  ) {
    this.schemasByFile = schemasByFile;
    this.additionalSchemasByFile = additionalSchemasByFile;
    this.badConfigFiles = {};
    this.configNamesByFile = {};
    this.parsedConfigs = {};
    for (const configPath in schemasByFile) {
      const parsed = path.parse(configPath);
      if (parsed.ext === '.yml') {
        this.badConfigFiles[`${parsed.dir}/${parsed.name}.yaml`] = configPath;
      } else if (parsed.ext === '.yaml') {
        this.badConfigFiles[`${parsed.dir}/${parsed.name}.yml`] = configPath;
      }
      this.configNamesByFile[configPath] = parsed.name;
    }
  }

  /**
   * Returns the parsed config for a given filename. Only available after
   * the config file has been validated (and is valid).
   * @param {string} filename The path of the config
   */
  public getConfig(filename: string): object | null {
    if (this.parsedConfigs[filename]) {
      return this.parsedConfigs[filename];
    }
    return null;
  }

  /**
   * A function for validate the config file against given schema. It
   * will create a failing Github Check per config fiel on the commit
   * when validation fails.
   *
   * @param {Octokit} octokit - Authenticated octokit object.
   * @param {string} owner - The owner of the base repository of the PR.
   * @param {string} repo - The name of the base repository of the PR.
   * @param {string} commitSha - The commit hash of the tip of the PR head.
   * @param {number} prNumber - The number of the PR.
   * @param {GCFLogger} logger - Optional. Logger for debug output.
   *
   * @return {Promise<boolean>} Returns 'true' if config is valid, 'false' if invalid.
   */
  public async validateConfigChanges(
    octokit: Octokit,
    owner: string,
    repo: string,
    commitSha: string,
    prNumber: number,
    logger: GCFLogger = defaultLogger
  ): Promise<boolean> {
    const errorTextByFile: Record<string, string[]> = {};
    function addError(file: string, message: string) {
      if (!errorTextByFile[file]) {
        errorTextByFile[file] = [];
      }
      errorTextByFile[file].push(message);
    }

    // Sometimes the head branch is gone.
    // In that case, the requests for fetching files might fail with 404.
    // We can just ignore those cases.
    try {
      const listFilesParams = {
        owner: owner,
        repo: repo,
        pull_number: prNumber,
        per_page: 50, // Currently 30 is GitHub's default.
      };
      for await (const response of octokit.paginate.iterator(
        octokit.rest.pulls.listFiles,
        listFilesParams
      )) {
        for (const file of response.data) {
          if (file.status === 'removed') {
            continue;
          }
          logger.trace(`file: ${file.filename}`);
          if (this.badConfigFiles[file.filename]) {
            // Trying to add a config file with a wrong file extension.
            addError(
              this.badConfigFiles[file.filename],
              `You tried to add ${file.filename}, but the config file must be ${
                this.badConfigFiles[file.filename]
              }`
            );
          }
          const schema = this.schemasByFile[file.filename];
          const additionalSchemas = this.additionalSchemasByFile[file.filename];
          if (schema) {
            const result = await validateFile(
              octokit,
              owner,
              repo,
              file.sha,
              file.filename,
              schema,
              {
                additionalSchemas,
              }
            );
            if (!result.isValid && result.errorText) {
              addError(file.filename, result.errorText);
            }
            if (result.config) {
              this.parsedConfigs[file.filename] = result.config as object;
            }
          }
        }
      }
    } catch (e) {
      const err = e as RequestError;
      if (err.status !== 404) {
        throw err;
      }
    }

    const files = Object.keys(errorTextByFile);
    for (const file of files) {
      const errorText = errorTextByFile[file].join('\n');
      const checkParams = {
        owner: owner,
        repo: repo,
        name: `${this.configNamesByFile[file]} config schema`,
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
    // Return false, if config is invalid, true if valid:
    return files.length > 0 ? false : true;
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

export class InvalidConfigurationFormat extends Error {
  readonly path: string;
  constructor(path: string, validationMessage?: string) {
    super(
      `Failed to validate the config schema at '${path}': ${validationMessage}`
    );
    this.path = path;
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
        throw new InvalidConfigurationFormat(path, validateResult.errorText);
      }
    } else {
      // This should not happen.
      throw new Error('could not handle getContent result.');
    }
  } catch (e) {
    const err = e as RequestError;
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
          throw new InvalidConfigurationFormat(path, validateResult.errorText);
        }
      } else {
        // This should not happen.
        throw new Error('could not handle getContent result.');
      }
    } catch (e) {
      const err = e as RequestError;
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
        throw new InvalidConfigurationFormat(path, validateResult.errorText);
      }
    } else {
      // This should not happen.
      throw new Error('could not handle getContent result.');
    }
  } catch (e) {
    const err = e as RequestError;
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
          throw new InvalidConfigurationFormat(path, validateResult.errorText);
        }
      } else {
        // This should not happen.
        throw new Error('could not handle getContent result.');
      }
    } catch (e) {
      const err = e as RequestError;
      if (err.status !== 404) {
        throw err;
      }
      return defaultConfig;
    }
  }
}
