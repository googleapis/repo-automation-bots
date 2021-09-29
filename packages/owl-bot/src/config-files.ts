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

function validatePath(path: string, fieldName: string) {
  if (path && path[0] !== '/') {
    throw `I expected the first character of ${fieldName} to be a '/'.  Instead, I found ${path}.`;
  }
}

// Throws an exception if the object does not have the necessary structure.
// Otherwise, returns the same object as an OwlBotYaml.
export function owlBotYamlFromText(yamlText: string): OwlBotYaml {
  const o = yaml.load(yamlText) ?? {};
  const validate = new Ajv().compile(owlBotYamlSchema);
  if (validate(o)) {
    const yaml = o as OwlBotYaml;
    for (const deepCopy of yaml['deep-copy-regex'] ?? []) {
      validatePath(deepCopy.dest, 'dest');
      validatePath(deepCopy.source, 'source');
      // Confirm it's a valid regular expression.
      toFrontMatchRegExp(deepCopy.source);
    }
    for (const removePath of yaml['deep-remove-regex'] ?? []) {
      validatePath(removePath, 'deep-remove-regex');
      // Confirm it's a valid regular expression.
      toFrontMatchRegExp(removePath);
    }
    for (const excludePath of yaml['deep-preserve-regex'] ?? []) {
      validatePath(excludePath, 'deep-preserve-regex');
      // Confirm it's a valid regular expression.
      toFrontMatchRegExp(excludePath);
    }
    return yaml;
  } else {
    throw validate.errors;
  }
}

/**
 * Given a source string from a yaml, convert it into a regular expression.
 *
 * Adds a ^ so the expression only matches the beginning of strings.
 */
export function toFrontMatchRegExp(regexp: string): RegExp {
  const leading = regexp[0] === '^' ? '' : '^';
  return new RegExp(`${leading}${regexp}`);
}
