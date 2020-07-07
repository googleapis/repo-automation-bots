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

import {GCFLogger} from '../../src/gcf-utils';
import {describe, beforeEach, afterEach, it} from 'mocha';
import pino from 'pino';
import {validateLogs, LogLine} from '../test-helpers';
import SonicBoom from 'sonic-boom';
import fs from 'fs';

describe('GCFLogger Integration', () => {
  let logger: pino.Logger;
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
    const levels: {[index: string]: number} = {
      trace: 10,
      debug: 20,
      info: 30,
      metric: 30,
      warn: 40,
      error: 50,
    };
    for (const level of Object.keys(levels)) {
      it(`logs ${level} level string`, done => {
        logger[level]('hello world');
        destination.on('ready', () => {
          const loggedLines: LogLine[] = readLogsAsObjects(destination);
          validateLogs(loggedLines, 1, ['hello world'], [], levels[level]);
          done();
        });
      });

      it(`logs ${level} level json`, done => {
        logger[level]({hello: 'world'});
        destination.on('ready', () => {
          const loggedLines: LogLine[] = readLogsAsObjects(destination);
          validateLogs(loggedLines, 1, [], [{hello: 'world'}], levels[level]);
          done();
        });
      });
    }
  }

  beforeEach(() => {
    destination = pino.destination(testStreamPath);
    logger = GCFLogger['initLogger'](destination);
  });

  testAllLevels();

  afterEach(() => {
    fs.unlinkSync(testStreamPath);
  });
});
