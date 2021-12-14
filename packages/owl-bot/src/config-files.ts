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

import Ajv, {DefinedError} from 'ajv';
import yaml from 'js-yaml';
import owlBotYamlSchema from './owl-bot-yaml-schema.json';

// The .github/.OwlBot.lock.yaml is stored on each repository that OwlBot
// is configured for, and indicates the docker container that should be run
// for post processing:
export interface OwlBotLock {
  docker: {
    image: string;
    digest: string;
  };
}

// The default path where .OwlBot.lock.yaml is expected to be found.
export const OWL_BOT_LOCK_PATH = '.github/.OwlBot.lock.yaml';

// Throws an exception if the object does not have the necessary structure.
// Otherwise, returns the same object as an OwlBotLock.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function owlBotLockFrom(o: Record<string, any>): OwlBotLock {
  if (typeof o.docker !== 'object') {
    throw Error('lock file did not contain "docker" key');
  }
  if (typeof o.docker.image !== 'string') {
    throw Error('docker.image was not a string');
  }
  if (typeof o.docker.digest !== 'string') {
    throw Error('docker.digest was not a string');
  }
  return o as OwlBotLock;
}

export interface DeepCopyRegex {
  source: string;
  dest: string;
}

// The .github/.OwlBot.yaml is stored on each repository that OwlBot
// is configured for, and indicates the docker container that should be run
// for post processing and which files from googleapis-gen should be copied.
export interface OwlBotYaml {
  docker?: {
    image: string;
  };
  squash?: boolean;
  'deep-copy-regex'?: DeepCopyRegex[];
  'deep-remove-regex'?: string[];
  'deep-preserve-regex'?: string[];
  'begin-after-commit-hash'?: string;
}

// The default path where .OwlBot.yaml is expected to be found.
export const DEFAULT_OWL_BOT_YAML_PATH = '.github/.OwlBot.yaml';

/**
 * Validates that a provided path is valid for owl-bot. We expect an
 * absolute path (starts with a `/`). If invalid, appends an error
 * message to the provided errors array.
 *
 * @param {string} path The candidate path
 * @param {string} fieldName The name of the path field. Used for building
 *   a nice error message.
 * @param {string[]} errorMessages The error message collector
 */
function validatePath(
  path: string,
  fieldName: string,
  errorMessages: string[]
) {
  if (!path.startsWith('/')) {
    errorMessages.push(
      `I expected the first character of ${fieldName} to be a '/'.  Instead, I found ${path}.`
    );
  }
}

/**
 * Validates that a regex is valid for owl-bot. If invalid, appends an
 * error message to the provided errors array.
 *
 * @param {string} regex The candidate regex
 * @param {string[]} errorMessages The error message collector
 */
function validateRegex(regex: string, errorMessages: string[]) {
  try {
    toFrontMatchRegExp(regex);
  } catch (e) {
    if (e instanceof SyntaxError) {
      errorMessages.push(e.toString());
    } else {
      throw e;
    }
  }
}

export class InvalidOwlBotConfigError extends Error {
  errorMessages: string[];
  constructor(errorMessages: string[]) {
    super('Invalid OwlBot.yaml config');
    this.errorMessages = errorMessages;
  }
}

/**
 * Throws an exception if the object does not have the necessary structure.
 * Otherwise, returns the same object as an OwlBotYaml.
 * @param {string} yamlText The input YAML config
 * @returns {OwlBotYaml} The parsed OwlBot config
 * @throws {InvalidOwlBotConfigError} If there are parse or validation errors.
 */
export function owlBotYamlFromText(yamlText: string): OwlBotYaml {
  const loaded = yaml.load(yamlText) ?? {};
  const validate = new Ajv().compile<OwlBotYaml>(owlBotYamlSchema);
  const errorMessages: string[] = [];
  if (!validate(loaded)) {
    for (const err of validate.errors as DefinedError[]) {
      const message = err?.message
        ? `${err.instancePath} ${err.message}`
        : JSON.stringify(err);
      errorMessages.push(message);
    }
    throw new InvalidOwlBotConfigError(errorMessages);
  }

  for (const deepCopy of loaded['deep-copy-regex'] ?? []) {
    validatePath(deepCopy.dest, 'dest', errorMessages);
    validatePath(deepCopy.source, 'source', errorMessages);
    // Confirm it's a valid regular expression.
    validateRegex(deepCopy.source, errorMessages);
  }
  for (const removePath of loaded['deep-remove-regex'] ?? []) {
    validatePath(removePath, 'deep-remove-regex', errorMessages);
    // Confirm it's a valid regular expression.
    validateRegex(removePath, errorMessages);
  }
  for (const excludePath of loaded['deep-preserve-regex'] ?? []) {
    validatePath(excludePath, 'deep-preserve-regex', errorMessages);
    // Confirm it's a valid regular expression.
    validateRegex(excludePath, errorMessages);
  }

  if (errorMessages.length > 0) {
    throw new InvalidOwlBotConfigError(errorMessages);
  }

  return loaded;
}

/**
 * Given a source string from a yaml, convert it into a regular expression.
 *
 * Adds a ^ so the expression only matches the beginning of strings.
 *
 * @throws {SyntaxError} if the regex is invalid
 */
export function toFrontMatchRegExp(regexp: string): RegExp {
  const leading = regexp[0] === '^' ? '' : '^';
  return new RegExp(`${leading}${regexp}`);
}
