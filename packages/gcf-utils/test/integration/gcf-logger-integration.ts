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

import {GCFLogger} from '../../src/logging/gcf-logger';
import {describe, beforeEach, afterEach, it} from 'mocha';
import pino from 'pino';
import {validateLogs, LogLine, logLevels} from '../test-helpers';
import SonicBoom from 'sonic-boom';
import fs from 'fs';

describe('GCFLogger Integration', () => {
  let logger: GCFLogger & {[key: string]: Function};
  const testStreamPath = './test-stream.txt';
  let destination: SonicBoom;

  function readLogsAsObjects(writeStream: SonicBoom): LogLine[] {
    try {
      writeStream.flushSync();
      const data: string = fs.readFileSync(testStreamPath, {
        encoding: 'utf8',
      });
      const lines: string[] = data
        .split('\n')
        .filter(line => line !== undefined && line !== null && line !== '');
      return lines.map(line => JSON.parse(line));
    } catch (error) {
      throw new Error(`Failed to read stream: ${error}`);
    }
  }

  function testAllLevels() {
    for (const level of Object.keys(logLevels)) {
      if (level === 'metric') {
        continue;
      }
      it(`logs ${level} level string`, done => {
        logger[level]('hello world');
        destination.on('ready', () => {
          const loggedLines: LogLine[] = readLogsAsObjects(destination);
          validateLogs(loggedLines, 1, ['hello world'], [], logLevels[level]);
          done();
        });
      });

      it(`logs ${level} level json`, done => {
        logger[level]({hello: 'world'});
        destination.on('ready', () => {
          const loggedLines: LogLine[] = readLogsAsObjects(destination);
          validateLogs(
            loggedLines,
            1,
            [],
            [{hello: 'world'}],
            logLevels[level]
          );
          done();
        });
      });
    }
  }

  beforeEach(() => {
    destination = pino.destination(testStreamPath);
    logger = new GCFLogger(destination) as GCFLogger & {
      [key: string]: Function;
    };
  });

  testAllLevels();

  afterEach(() => {
    fs.unlinkSync(testStreamPath);
  });
});
