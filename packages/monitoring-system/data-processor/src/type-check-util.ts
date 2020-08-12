// Copyright 2020 Google LLC
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
//

/**
 * Returns true if the given paramter has type 'object'
 * @param toCheck object to check
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function isObject(toCheck: any): toCheck is {[key: string]: any} {
  return typeof toCheck === 'object';
}

/**
 * Returns true if the given parameter has type 'string'
 * @param toCheck string to check
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function isString(toCheck: any): toCheck is string {
  return typeof toCheck === 'string';
}

/**
 * Returns true if for every property in 'properties' object has a key with
 * that name and the value is of type string.
 * @param toCheck object to check
 * @param properties properties to assert
 */
export function hasStringProperties(
  /* eslint-disable @typescript-eslint/no-explicit-any */
  toCheck: {[key: string]: any},
  properties: string[]
): boolean {
  return hasPropertiesOfType(toCheck, properties, 'string');
}

/**
 * Returns true if for every property in 'properties' object has a key with
 * that name and the value is of type object.
 * @param toCheck object to check
 * @param properties properties to assert
 */
export function hasObjectProperties(
  /* eslint-disable @typescript-eslint/no-explicit-any */
  toCheck: {[key: string]: any},
  properties: string[]
): boolean {
  return hasPropertiesOfType(toCheck, properties, 'object');
}

/**
 * Returns true if for every property in 'properties' object has a key with
 * that name and the value is of type 'type'.
 * @param toCheck object to check
 * @param properties properties to assert
 * @param type expected value type
 */
export function hasPropertiesOfType(
  /* eslint-disable @typescript-eslint/no-explicit-any */
  toCheck: {[key: string]: any},
  properties: string[],
  type: string
): boolean {
  return properties.every(prop => {
    return toCheck[prop] && typeof toCheck[prop] === type;
  });
}

/**
 * Returns true if for every property in 'properties' object
 * has a key with that name
 * @param toCheck object to check
 * @param properties properties to assert
 */
export function hasProperties(
  /* eslint-disable @typescript-eslint/no-explicit-any */
  toCheck: {[key: string]: any},
  properties: string[]
): boolean {
  return properties.every(prop => toCheck[prop] !== undefined);
}

/**
 * Returns true if any value of the object is undefined
 * @param toCheck object to check
 */
export function hasUndefinedValues(toCheck: {[key: string]: any}): boolean {
  return !Object.keys(toCheck).every(key => toCheck[key] !== undefined);
}
