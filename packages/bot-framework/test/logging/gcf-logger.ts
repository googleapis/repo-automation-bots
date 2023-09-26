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

import {logger} from '../../src/';
import {GCFLogger} from '../../src/logging/gcf-logger';
import {describe, beforeEach, it} from 'mocha';
import {ObjectWritableMock} from 'stream-mock';
import {validateLogs, LogLine, logLevels} from './test-helpers';
import assert from 'assert';

describe('GCFLogger', () => {
  describe('gcf-util', () => {
    it('exports a GCFLogger', () => {
      logger.info('successfully imported logger from gcf-utils');
    });
  });
  describe('logger instance', () => {
    let destination: ObjectWritableMock;
    let logger: GCFLogger;

    beforeEach(() => {
      destination = new ObjectWritableMock();
      logger = new GCFLogger(destination) as GCFLogger & {
        [key: string]: Function;
      };
    });

    testAllLevels();

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
      for (const level of Object.keys(logLevels)) {
        if (level === 'metric') continue; // Metric is special case with own tests.
        it(`logs ${level} level string`, () => {
          (logger as any)[level]('hello world');
          const loggedLines: LogLine[] = readLogsAsObjects(destination);
          validateLogs(loggedLines, 1, ['hello world'], [], logLevels[level]);
        });

        it(`logs ${level} level json`, () => {
          (logger as any)[level]({hello: 'world'});
          const loggedLines: LogLine[] = readLogsAsObjects(destination);
          validateLogs(
            loggedLines,
            1,
            [],
            [{hello: 'world'}],
            logLevels[level]
          );
        });

        it(`allows ${level} log to be passed as argument`, done => {
          setTimeout((logger as any)[level], 1);
          setTimeout(() => {
            return done();
          });
        });
      }
    }

    describe('metric', () => {
      it('populates event, count, type, when single string argument provided', () => {
        logger.metric('release-created');
        const loggedLines: LogLine[] = readLogsAsObjects(destination);
        validateLogs(
          loggedLines,
          1,
          [],
          [{event: 'release-created', count: 1, type: 'metric'}],
          logLevels['metric']
        );
      });
      it('does not allow type to be accidentally overridden', () => {
        logger.metric('release-created', {type: 'foo'});
        const loggedLines: LogLine[] = readLogsAsObjects(destination);
        validateLogs(
          loggedLines,
          1,
          [],
          [{event: 'release-created', count: 1, type: 'metric'}],
          logLevels['metric']
        );
      });
      it('populates event, count, type, structured logs, when object provided as second argument', () => {
        logger.metric('release-created', {
          url: 'https://www.example.com',
        });
        const loggedLines: LogLine[] = readLogsAsObjects(destination);
        validateLogs(
          loggedLines,
          1,
          [],
          [
            {
              event: 'release-created',
              count: 1,
              type: 'metric',
              url: 'https://www.example.com',
            },
          ],
          logLevels['metric']
        );
      });
      it('allows count to be overridden', () => {
        logger.metric('release-created', {count: 4});
        const loggedLines: LogLine[] = readLogsAsObjects(destination);
        validateLogs(
          loggedLines,
          1,
          [],
          [{event: 'release-created', count: 4, type: 'metric'}],
          logLevels['metric']
        );
      });
    });

    describe('child', () => {
      let childLogger: GCFLogger;
      beforeEach(() => {
        logger.addBindings({foo: 'bar'});
        childLogger = logger.child({asdf: 'qwer'});
      });
      it('inherits destination from parent', () => {
        logger.info('this is a test message');
        childLogger.info('another test message');
        const loggedLines: LogLine[] = readLogsAsObjects(destination);
        assert.equal(loggedLines.length, 2);
      });
      it('does not affect original logger', () => {
        logger.info('this is a test message');
        const loggedLines: LogLine[] = readLogsAsObjects(destination);
        assert.equal(loggedLines[0]['foo'], 'bar');
        assert.equal(loggedLines[0]['asdf'], undefined);
      });
      it('preserves existing bindings', () => {
        childLogger.warn('this is a child message');
        const loggedLines: LogLine[] = readLogsAsObjects(destination);
        assert.equal(loggedLines[0]['foo'], 'bar');
        assert.equal(loggedLines[0]['asdf'], 'qwer');
      });
    });
  });
});
