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
import { getLogsFromStream, validateLogs } from '../fixtures/GCFLogger-test-helpers';
import stream from 'memory-streams';

describe('gcf-utils Integration', () => {
  describe('GCFLogger Integration', () => {
    let logger: pino.Logger;
    let writeStream: stream.WritableStream;

    beforeEach(() => {
      writeStream = new stream.WritableStream();
      logger = GCFLogger["initLogger"]({}, writeStream);
    });

    it('logs a debug level string', () => {
      logger.debug('hello world');
      let loggedLines = getLogsFromStream(writeStream);
      validateLogs(loggedLines, 1, ['hello world'], [], 20);
    });

    it('logs a debug level json', () => {
      logger.debug({ 'hello': 'world' });
      let loggedLines = getLogsFromStream(writeStream);
      validateLogs(loggedLines, 1, [], [{ 'hello': 'world' }], 20);
    });

    it('logs an info level string', () => {
      logger.info('hello world');
      let loggedLines = getLogsFromStream(writeStream);
      validateLogs(loggedLines, 1, ['hello world'], [], 30);
    });

    it('logs an info level json', () => {
      logger.info({ 'hello': 'world' });
      let loggedLines = getLogsFromStream(writeStream);
      validateLogs(loggedLines, 1, [], [{ 'hello': 'world' }], 30);
    });

    it('logs a metric level string', () => {
      logger.metric('hello world');
      let loggedLines = getLogsFromStream(writeStream);
      validateLogs(loggedLines, 1, ['hello world'], [], 30);
    });

    it('logs a metric level json', () => {
      logger.metric({ 'hello': 'world' });
      let loggedLines = getLogsFromStream(writeStream);
      validateLogs(loggedLines, 1, [], [{ 'hello': 'world' }], 30);
    });

    it('logs a warn level string', () => {
      logger.warn('hello world');
      let loggedLines = getLogsFromStream(writeStream);
      validateLogs(loggedLines, 1, ['hello world'], [], 40);
    });

    it('logs a warn level json', () => {
      logger.warn({ 'hello': 'world' });
      let loggedLines = getLogsFromStream(writeStream);
      validateLogs(loggedLines, 1, [], [{ 'hello': 'world' }], 40);
    });

    it('logs an error level string', () => {
      logger.error('hello world');
      let loggedLines = getLogsFromStream(writeStream);
      validateLogs(loggedLines, 1, ['hello world'], [], 50);
    });

    it('logs an error level json', () => {
      logger.error({ 'hello': 'world' });
      let loggedLines = getLogsFromStream(writeStream);
      validateLogs(loggedLines, 1, [], [{ 'hello': 'world' }], 50);
    });

    afterEach(() => {
      writeStream.end();
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
