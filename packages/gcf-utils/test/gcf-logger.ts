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

import {logger} from '../src/gcf-utils';
import {GCFLogger, initLogger} from '../src/logging/gcf-logger';
import {describe, beforeEach, it} from 'mocha';
import {ObjectWritableMock} from 'stream-mock';
import {validateLogs, LogLine, logLevels} from './test-helpers';

describe('GCFLogger', () => {
  describe('gcf-util', () => {
    it('exports a GCFLogger', () => {
      logger.info('successfully imported logger from gcf-utils');
    });
  });
  describe('logger instance', () => {
    let destination: ObjectWritableMock;
    let loggerNoBindings: GCFLogger & {[key: string]: Function};
    let loggerWithBindings: GCFLogger & {[key: string]: Function};
    const bindings = {foo: 'bar-binding'};

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
        it(`logs ${level} level string`, () => {
          loggerNoBindings[level]('hello world');
          const loggedLines: LogLine[] = readLogsAsObjects(destination);
          validateLogs(loggedLines, 1, ['hello world'], [], logLevels[level]);
        });

        it(`logs ${level} level json`, () => {
          loggerNoBindings[level]({hello: 'world'});
          const loggedLines: LogLine[] = readLogsAsObjects(destination);
          validateLogs(
            loggedLines,
            1,
            [],
            [{hello: 'world'}],
            logLevels[level]
          );
        });

        it(`logs ${level} level string with bindings`, () => {
          loggerWithBindings[level]('hello world');
          const loggedLines: LogLine[] = readLogsAsObjects(destination);
          validateLogs(
            loggedLines,
            1,
            ['hello world'],
            [bindings],
            logLevels[level]
          );
        });

        it(`logs ${level} level json with bindings`, () => {
          loggerWithBindings[level]({hello: 'world'});
          const loggedLines: LogLine[] = readLogsAsObjects(destination);
          validateLogs(
            loggedLines,
            1,
            [],
            [{...bindings, hello: 'world'}],
            logLevels[level]
          );
        });
      }
    }

    beforeEach(() => {
      destination = new ObjectWritableMock();
      loggerNoBindings = initLogger({destination}) as GCFLogger & {
        [key: string]: Function;
      };
      loggerWithBindings = loggerNoBindings.child(bindings) as GCFLogger & {
        [key: string]: Function;
      };
    });

    testAllLevels();
  });
});
