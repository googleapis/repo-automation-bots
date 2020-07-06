// Copyright 2019 Google LLC
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
import { GCFBootstrapper, GCFLogger } from '../../src/gcf-utils';
import { describe, beforeEach, afterEach, it } from 'mocha';
import { Application } from 'probot';
import { resolve } from 'path';
import { config } from 'dotenv';
import pino from 'pino';
import { validateLogs } from '../test-helpers';
import SonicBoom from 'sonic-boom';
import fs from 'fs';

describe('gcf-utils Integration', () => {
  describe('GCFLogger Integration', () => {
    let logger: pino.Logger;
    let testStreamPath: string = './test-stream.txt';
    let writeStream: SonicBoom;

    function readLogsAsObjects(writeStream: SonicBoom): any[] {
      writeStream.flushSync();
      let data: string = fs.readFileSync(testStreamPath, { encoding: "utf8" })
      let lines: string[] = data.split('\n').filter((line) => line != null && line !== '');
      return lines.map((line) => JSON.parse(line));
    }

    function testAllLevels() {
      let levels: { [index: string]: number } = {
        trace: 10,
        debug: 20,
        info: 30,
        metric: 30,
        warn: 40,
        error: 50
      }
      for (let level of Object.keys(levels)) {
        it(`logs ${level} level string`, (done) => {
          logger[level]('hello world');
          writeStream.on('ready', () => {
            let loggedLines = readLogsAsObjects(writeStream);
            validateLogs(loggedLines, 1, ['hello world'], [], levels[level]);
            done();
          });
        });

        it(`logs ${level} level json`, (done) => {
          logger[level]({ 'hello': 'world' });
          writeStream.on('ready', () => {
            let loggedLines = readLogsAsObjects(writeStream);
            validateLogs(loggedLines, 1, [], [{ 'hello': 'world' }], levels[level]);
            done();
          });
        });
      }
    }

    beforeEach(() => {
      writeStream = pino.destination(testStreamPath);
      logger = GCFLogger["initLogger"](undefined, writeStream);
    });

    testAllLevels();

    afterEach(() => {
      fs.unlinkSync(testStreamPath);
    });
  });

  describe('GCFBootstrapper Integration', () => {
    describe('getProbotConfig', () => {
      let bootstrapper: GCFBootstrapper;

      beforeEach(async () => {
        bootstrapper = new GCFBootstrapper();
        config({ path: resolve(__dirname, '../../../.env') });
      });

      afterEach(() => { });

      it('returns valid options', async () => {
        await bootstrapper.getProbotConfig();
      });
    });

    describe('loadProbot', () => {
      let bootstrapper: GCFBootstrapper;

      beforeEach(async () => {
        bootstrapper = new GCFBootstrapper();
        config({ path: resolve(__dirname, '../../.env') });
      });

      it('is called properly', async () => {
        const pb = await bootstrapper.loadProbot((app: Application) => {
          app.on('foo', async () => {
            console.log('We are called!');
          });
        });

        await pb.receive({
          name: 'foo',
          id: 'bar',
          payload: 'baz',
        });
      });
    });
  });
})
