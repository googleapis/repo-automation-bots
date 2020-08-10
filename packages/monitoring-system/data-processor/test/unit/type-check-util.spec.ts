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
import {
  hasUndefinedValues,
  isObject,
  isString,
  hasStringProperties,
  hasObjectProperties,
  hasProperties,
} from '../../src/type-check-util';


describe('type-check-util', () => {
  describe('isObject', () => {
    it('returns true for a valid object', () => {
      assert(isObject({foo: 'bar'}));
    });
    it('returns false for an invalid object', () => {
      assert(!isObject('bar'));
    });
  });


  describe('isString', () => {
    it('returns true for a valid string', () => {
      assert(isString('bar'));
    });
    it('returns false for an invalid string', () => {
      assert(!isString({foo: 'bar'}));
    });
  });


  describe('hasStringProperties', () => {
    it('returns true if object has all the string properties', () => {
      const testObject = {
        foo: 1,
        bar: 'abc',
        baz: 'xyz',
      };
      assert(hasStringProperties(testObject, ['bar', 'baz']));
    });
    it('returns true for empty properties', () => {
      const testObject = {
        foo: 1,
        bar: 'abc',
        baz: 'xyz',
      };
      assert(hasStringProperties(testObject, []));
    });
    it('returns false if object has all properties but some are not strings', () => {
      const testObject = {
        foo: 1,
        bar: 'abc',
        baz: 'xyz',
      };
      assert(!hasStringProperties(testObject, ['bar', 'baz', 'foo']));
    });
    it('returns false if object has some of the the string properties', () => {
      const testObject = {
        foo: 1,
        bar: 'abc',
        baz: 'xyz',
      };
      assert(!hasStringProperties(testObject, ['bar', 'baz', 'far']));
    });
    it('returns false if object has none of the the string properties', () => {
      const testObject = {
        foo: 1,
        bar: 'abc',
        baz: 'xyz',
      };
      assert(!hasStringProperties(testObject, ['abc', 'xyz']));
    });
    it('returns false for an empty object but non-empty properties', () => {
      assert(!hasStringProperties({}, ['bar', 'baz']));
    });
  });


  describe('hasObjectProperties', () => {
    it('returns true if object has all the object properties', () => {
      const testObject = {
        foo: 1,
        bar: {some: 'object'},
        baz: {another: 'object'},
      };
      assert(hasObjectProperties(testObject, ['bar', 'baz']));
    });
    it('returns true for empty properties', () => {
      const testObject = {
        foo: 1,
        bar: {some: 'object'},
        baz: {another: 'object'},
      };
      assert(hasObjectProperties(testObject, []));
    });
    it('returns false if object has all properties but some are not objects', () => {
      const testObject = {
        foo: 1,
        bar: {some: 'object'},
        baz: {another: 'object'},
      };
      assert(!hasObjectProperties(testObject, ['bar', 'baz', 'foo']));
    });
    it('returns false if object has some of the the object properties', () => {
      const testObject = {
        foo: 1,
        bar: {some: 'object'},
        baz: {another: 'object'},
      };
      assert(!hasObjectProperties(testObject, ['bar', 'baz', 'far']));
    });
    it('returns false if object has none of the the object properties', () => {
      const testObject = {
        foo: 1,
        bar: {some: 'object'},
        baz: {another: 'object'},
      };
      assert(!hasObjectProperties(testObject, ['abc', 'xyz']));
    });
    it('returns false for an empty object but non-empty properties', () => {
      assert(!hasObjectProperties({}, ['bar', 'baz', 'foo']));
    });
  });


  describe('hasProperties', () => {
    it('returns true if object has all the properties', () => {
      const testObject = {foo: 1, bar: 2, baz: false};
      assert(hasProperties(testObject, ['foo', 'bar']));
      assert(hasProperties(testObject, ['foo', 'bar', 'baz']));
    });
    it('returns true for empty properties', () => {
      const testObject = {foo: 1, bar: 2, baz: false};
      assert(hasProperties(testObject, []));
    });
    it('returns false if object has some of the the properties', () => {
      const testObject = {foo: 1, bar: 2, baz: false};
      assert(!hasProperties(testObject, ['foo', 'bar', 'bear']));
    });
    it('returns false if object has none of the the properties', () => {
      const testObject = {foo: 1, bar: 2, baz: false};
      assert(!hasProperties(testObject, ['abc', 'def', 'ghi']));
    });
    it('returns false for an empty object but non-empty properties', () => {
      const testObject = {};
      assert(!hasProperties(testObject, ['foo', 'bar', 'bear']));
    });
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