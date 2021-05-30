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
import * as fs from 'fs';
import yaml from 'js-yaml';
import schema from './selectors-schema.json';
const objectSelector = require('easy-object-selector');

/**
 * This type represents the `value` part of a single Selector.
 */
export type SelectorValueType = string | number | boolean | Array<string>;

/**
 * This type represents the `operator` part of a single Selector.
 */
export type Operator = 'eq' | 'ne' | 'anyof' | 'regex';

/**
 * The type `Selector` is a list with 3 fields:
 *   - Descriptor - represents the target property
 *   - Operator
 *   - Value
 */
export type Selector = [string, Operator, SelectorValueType];

/**
 * Selectors represetns one or more Selectors combined with `AND`.
 */
export type Selectors = Array<Selector>;

/**
 * Loads `Selectors` from a yaml file.
 */
export function loadSelectors(fileName: string): Selectors {
  const selectorsYaml = fs.readFileSync(fileName);
  const candidate = yaml.load(selectorsYaml.toString());
  const ajv = new Ajv();
  const validateSchema = ajv.compile(schema);
  const result = validateSchema(candidate);
  if (!result) {
    throw new Error(JSON.stringify(validateSchema.errors, null, 4));
  }
  return candidate as Selectors;
}

/**
 * A convenient shortcut for Repository selection.
 */
export function RepoDescriptorConvertor(input: string): string {
  if (input === 'org' || input === 'organization') {
    return 'owner.login';
  }
  return input;
}

/**
 * This class accepts a list of `Selectors` (note: `Selectors` is a
 * list of `Selector`). Each `Selectors` are combined with OR.
 */
export class ObjectSelector<T> {
  private listOfSelectors: Array<Selectors>;
  private descriptorConvertor: (input: string) => string;
  constructor(
    listOfSelectors: Array<Selectors>,
    descriptorConvertor: (input: string) => string = (
      input: string
    ): string => {
      return input;
    }
  ) {
    this.listOfSelectors = listOfSelectors;
    this.descriptorConvertor = descriptorConvertor;
  }
  /**
   * It will apply Selectors to the given Iterable and returns matched objects.
   */
  public select(targets: Iterable<T>): Array<T> {
    const result: Array<T> = [];
    for (const target of targets) {
      if (this.match(target)) {
        result.push(target);
      }
    }
    return result;
  }
  /**
   * It will apply Selectors to the given object and return the result.
   */
  public match(target: T): boolean {
    // Each `Selectors` represents a list of Selectors combined with AND
    // If any of the `Selectors` accept the target, we'll select it.
    for (const selectors of this.listOfSelectors) {
      if (this._filter(selectors, target)) {
        // no need to evaluate remaining selectors.
        return true;
      }
    }
    return false;
  }

  private _filter(selectors: Selectors, candidate: T): boolean {
    // Empty selectors don't match anything.
    if (selectors.length === 0) {
      return false;
    }
    // If any of the selector declines the target, we return false.
    for (const selector of selectors) {
      if (!this._select(selector, candidate)) {
        return false;
      }
    }
    return true;
  }
  private _select(selector: Selector, candidate: T): boolean {
    let descriptor = selector[0];
    const operator = selector[1];
    const value = selector[2];
    // Convert a well known shortcut to actual descriptor.
    descriptor = this.descriptorConvertor(descriptor);
    // First get the target value from the object.
    const select = objectSelector.select;
    const actualValue = select(candidate, descriptor);
    if (operator === 'eq') {
      return actualValue === value;
    } else if (operator === 'ne') {
      return actualValue !== value;
    } else if (operator === 'anyof') {
      if (!Array.isArray(value)) {
        return false;
      }
      return value.includes(actualValue);
    } else if (operator === 'regex') {
      if (typeof value !== 'string') {
        return false;
      }
      try {
        const re = new RegExp(value);
        return actualValue.match(re);
      } catch (err) {
        // All the regex error is just returning false.
        return false;
      }
    }
    return false;
  }
}
