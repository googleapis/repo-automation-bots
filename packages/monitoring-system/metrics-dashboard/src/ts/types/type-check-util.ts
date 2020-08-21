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
