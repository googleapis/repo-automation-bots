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
import {describe, it} from 'mocha';
import assert from 'assert';
import {hasUndefinedValues} from '../../../src/types/type-check-util';

// TODO: implement these

describe('type-check-util', () => {
  describe('isObject', () => {
    it('returns true for a valid object');
    it('returns false for an invalid object');
  });

  describe('isString', () => {
    it('returns true for a valid string');
    it('returns false for an invalid string');
  });

  describe('hasStringProperties', () => {
    it('returns true if object has all the string properties');
    it('returns true for empty properties');
    it(
      'returns false if object has all the properties but some are not strings'
    );
    it('returns false if object has some of the the string properties');
    it('returns false if object has none of the the string properties');
    it('returns false for an empty object but non-empty properties');
  });

  describe('hasObjectProperties', () => {
    it('returns true if object has all the object properties');
    it('returns true for empty properties');
    it(
      'returns false if object has all the properties but some are not objects'
    );
    it('returns false if object has some of the the object properties');
    it('returns false if object has none of the the object properties');
    it('returns false for an empty object but non-empty properties');
  });

  describe('hasProperties', () => {
    it('returns true if object has all the properties');
    it('returns true for empty properties');
    it('returns false if object has some of the the properties');
    it('returns false if object has none of the the properties');
    it('returns false for an empty object but non-empty properties');
  });

  describe('hasUndefinedValues', () => {
    it('should return false for object with no undefined values', () => {
      const testObject = {
        foo: 1,
        bar: 'baz',
      };
      assert(!hasUndefinedValues(testObject));
    });
    it('should return false for empty object', () => {
      const testObject = {};
      assert(!hasUndefinedValues(testObject));
    });
    it('should return true for object with undefined values', () => {
      const testObject = {
        foo: 1,
        bar: undefined,
      };
      assert(hasUndefinedValues(testObject));
    });
  });
});
