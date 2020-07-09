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

import {GCFLogger, initLogger} from '../src/gcf-utils';
import {describe, beforeEach, it} from 'mocha';
import {ObjectWritableMock} from 'stream-mock';
import {validateLogs, LogLine, logLevels} from './test-helpers';

describe('GCFLogger', () => {
  describe('logger instance', () => {
    let destination: ObjectWritableMock;
    let logger: GCFLogger;

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
          logger[level]('hello world');
          const loggedLines: LogLine[] = readLogsAsObjects(destination);
          validateLogs(loggedLines, 1, ['hello world'], [], logLevels[level]);
        });

        it(`logs ${level} level json`, () => {
          logger[level]({hello: 'world'});
          const loggedLines: LogLine[] = readLogsAsObjects(destination);
          validateLogs(
            loggedLines,
            1,
            [],
            [{hello: 'world'}],
            logLevels[level]
          );
        });
      }
    }

    beforeEach(() => {
      destination = new ObjectWritableMock();
      logger = initLogger(destination);
    });

    testAllLevels();
  });
});
