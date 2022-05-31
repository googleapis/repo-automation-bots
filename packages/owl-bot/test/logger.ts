// Copyright 2022 Google LLC
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

// Wrapping the console which takes any params.
/* eslint-disable @typescript-eslint/no-explicit-any */

import {describe, it} from 'mocha';
import * as assert from 'assert';
import {Logger, LoggerWithTimestamp} from '../src/logger';

class FakeLogger implements Logger {
  calls: ['log' | 'error' | 'warn' | 'info', any, any[]][] = [];
  log(msg: any, ...params: any[]): void {
    this.calls.push(['log', msg, params]);
  }
  error(msg: any, ...params: any[]): void {
    this.calls.push(['error', msg, params]);
  }
  warn(msg: any, ...params: any[]): void {
    this.calls.push(['warn', msg, params]);
  }
  info(msg: any, ...params: any[]): void {
    this.calls.push(['info', msg, params]);
  }
}

describe('LoggerWithTimestamp', () => {
  it('logs simple text', () => {
    const inner = new FakeLogger();
    const logger = new LoggerWithTimestamp(inner);
    logger.log('hello world');
    assert.equal(inner.calls.length, 1);
    const call = inner.calls[0];
    assert.equal(call[0], 'log');
    assert.match(call[1], /.* hello world/);
    assert.deepStrictEqual(call[2], []);
  });

  it('logs text with a substitution', () => {
    const inner = new FakeLogger();
    const logger = new LoggerWithTimestamp(inner);
    logger.info('hello %s', 'chickens');
    assert.equal(inner.calls.length, 1);
    const call = inner.calls[0];
    assert.equal(call[0], 'info');
    assert.match(call[1], /.* hello %s/);
    assert.deepStrictEqual(call[2], ['chickens']);
  });

  it('logs multiple objects', () => {
    const inner = new FakeLogger();
    const logger = new LoggerWithTimestamp(inner);
    logger.warn({a: 1}, {b: 2});
    assert.equal(inner.calls.length, 1);
    const call = inner.calls[0];
    assert.equal(call[0], 'warn');
    assert.ok(typeof call[1] === 'string'); // The timestamp.
    assert.deepStrictEqual(call[2], [{a: 1}, {b: 2}]);
  });
});
