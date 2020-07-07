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

import {GCFLogger} from '../src/gcf-utils';
import {describe, beforeEach, it} from 'mocha';
import assert from 'assert';
import {ObjectWritableMock} from 'stream-mock';
import pino from 'pino';
import {validateLogs, LogLine} from './test-helpers';

describe('GCFLogger', () => {
  describe('get()', () => {
    it('returns a new pino-based logger instance on first call', () => {
      const logger = GCFLogger.get();
      assert.equal(logger.constructor.name, 'Pino');
    });
    it('returns the same logger instance on two consecutive calls', () => {
      const logger1 = GCFLogger.get();
      const logger2 = GCFLogger.get();
      assert.deepEqual(logger1, logger2);
    });
  });

  describe('logger instance', () => {
    let writeStream: ObjectWritableMock;
    let logger: pino.Logger;

    function readLogsAsObjects(writeStream: ObjectWritableMock): LogLine[] {
      try {
        writeStream.end();
        const lines: string[] = writeStream.data;
        return lines.map(line => JSON.parse(line));
      } catch (error) {
        throw new Error(`Failed to read stream: ${error}`);
      }
    }

    function testAllLevels() {
      const levels: {[index: string]: number} = {
        trace: 10,
        debug: 20,
        info: 30,
        metric: 30,
        warn: 40,
        error: 50,
      };

      for (const level of Object.keys(levels)) {
        it(`logs ${level} level string`, () => {
          logger[level]('hello world');
          const loggedLines: LogLine[] = readLogsAsObjects(writeStream);
          validateLogs(loggedLines, 1, ['hello world'], [], levels[level]);
        });

        it(`logs ${level} level json`, () => {
          logger[level]({hello: 'world'});
          const loggedLines: LogLine[] = readLogsAsObjects(writeStream);
          validateLogs(loggedLines, 1, [], [{hello: 'world'}], levels[level]);
        });
      }
    }

    beforeEach(() => {
      writeStream = new ObjectWritableMock();
      logger = GCFLogger['initLogger'](writeStream);
    });

    testAllLevels();
  });
});
