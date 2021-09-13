// Copyright 2021 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {describe, it, afterEach} from 'mocha';
import assert from 'assert';
import sinon from 'sinon';
import nock from 'nock';
import {resolve} from 'path';

import {Selectors, loadSelectors, ObjectSelector} from '../src/object-selector';

const sandbox = sinon.createSandbox();
nock.disableNetConnect();
const fixturesPath = resolve(__dirname, '../../test/fixtures');

interface TestObject {
  name: string;
  id: number;
  evil: boolean;
  children?: TestObject[];
}

describe('object-selector', () => {
  afterEach(() => {
    sandbox.restore();
    nock.cleanAll();
  });

  describe('loadSelectors', () => {
    const objs = require(resolve(fixturesPath, './objs'));
    it('throws an error with a wrong format', () => {
      assert.throws(
        () => loadSelectors('test/fixtures/wrong.yaml'),
        /must be array/
      );
    });
    it('loads Selectors correctly', () => {
      const selectors = loadSelectors('test/fixtures/correct.yaml');
      assert.strictEqual(selectors.length, 1);
      assert.strictEqual(selectors[0].length, 3);
      assert.strictEqual(selectors[0][0], 'name');
      assert.strictEqual(selectors[0][1], 'eq');
      assert.strictEqual(selectors[0][2], 'test');
    });
    it('select collect objects with "eq" operator', () => {
      const selectors = loadSelectors('test/fixtures/correct.yaml');
      const objSelector = new ObjectSelector<TestObject>([selectors]);
      const selected = objSelector.select(objs);
      objectAssert(selected, ['test']);
    });
    it('select collect objects with "ne" operator', () => {
      const selectors: Selectors = [
        ['evil', 'eq', true],
        ['name', 'ne', 'evil'],
      ];
      const objSelector = new ObjectSelector<TestObject>([selectors]);
      const selected = objSelector.select(objs);
      objectAssert(selected, ['name2']);
    });
    it('select collect objects with multipel Selectors combined with OR', () => {
      const selectors1: Selectors = [['name', 'eq', 'test']];
      const selectors2: Selectors = [['name', 'eq', 'evil']];
      const objSelector = new ObjectSelector<TestObject>([
        selectors1,
        selectors2,
      ]);
      const selected = objSelector.select(objs);
      objectAssert(selected, ['test', 'evil']);
    });
    it('select collect objects with a regex', () => {
      const selectors: Selectors = [['name', 'regex', '(test|hasachild)']];
      const objSelector = new ObjectSelector<TestObject>([selectors]);
      const selected = objSelector.select(objs);
      objectAssert(selected, ['test', 'hasachild']);
    });
    it('select collect objects with an array index', () => {
      const selectors: Selectors = [['children.0.name', 'regex', 'child']];
      const objSelector = new ObjectSelector<TestObject>([selectors]);
      const selected = objSelector.select(objs);
      objectAssert(selected, ['hasachild', 'hasagrandchild']);
    });
    it('select collect objects with "anyof" operator', () => {
      const selectors: Selectors = [['name', 'anyof', ['test', 'name2']]];
      const objSelector = new ObjectSelector<TestObject>([selectors]);
      const selected = objSelector.select(objs);
      objectAssert(selected, ['test', 'name2']);
    });
    it('select collect objects with nested property', () => {
      const selectors: Selectors = [['children.0.children.0.id', 'eq', 8]];
      const objSelector = new ObjectSelector<TestObject>([selectors]);
      const selected = objSelector.select(objs);
      objectAssert(selected, ['hasagrandchild']);
    });
    it('returns nothing with empty selectors', () => {
      // force creating an empty selectors.
      const selectors: Selectors = [];
      const objSelector = new ObjectSelector<TestObject>([selectors]);
      const selected = objSelector.select(objs);
      assert.strictEqual(selected.length, 0);
    });
  });
});

function objectAssert(selected: TestObject[], expected: string[]) {
  assert.strictEqual(expected.length, selected.length);
  assert.ok(
    selected.every((obj: TestObject) => {
      return expected.includes(obj.name);
    })
  );
}
