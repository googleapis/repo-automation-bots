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
import {GCFBootstrapper, GCFLogger} from '../../src/gcf-utils';
import {describe, beforeEach, afterEach, it} from 'mocha';
import {Application} from 'probot';
import {resolve} from 'path';
import {config} from 'dotenv';
import pino from 'pino';
import assert from 'assert';
import stream from 'memory-streams';

describe('gcf-utils Integration', () => {
  describe('GCFLogger Integration', () => {
    let logger: pino.Logger;
    let writeStream: stream.WritableStream;
    
    function getLogsFromStream(writeStream: stream.WritableStream): any[] {
      try {
        let stringData: string = writeStream.toString();
        let lines: string[] = stringData.split('\n').filter((line) => line != null && line !== '');
        let jsonArray: any[] = lines.map((line) => JSON.parse(line));
        return jsonArray;
      } catch (error) {
        throw new Error(`Failed to read write stream: ${error}`);
      }
    }

    function validateLogs(
      logs: any[], 
      expectedLineCount?: number, 
      expectedMessages?: string[], 
      expectedKeyValues?: Array<{[idx: string]: any}>, 
      expectedLogLevel?: number
    ): void {
      if (expectedLineCount) {
        assert.equal(logs.length, expectedLineCount, 
          `expected exactly ${expectedLineCount} line(s) to be logged`);
      }
      if (expectedMessages) {
        for (let i=0; i < expectedMessages.length; i++) {
          assert.equal(logs[i]["msg"], expectedMessages[i], 
          `expected log message to be ${expectedMessages[i]} but was instead ${logs[i]["msg"]}`);
        }
      }
      if (expectedKeyValues) {
        for (let i=0; i < expectedKeyValues.length; i++) {
          for (let key of Object.keys(expectedKeyValues[i])) {
            assert.equal(logs[i][key], expectedKeyValues[i][key], 
              `expected log line ${i} to have property ${key} with value ${expectedKeyValues[i][key]}`);
          }
        }
      }
      if (expectedLogLevel) {
        for (let line of logs) {
          assert.equal(line["level"], expectedLogLevel, 
          `expected logs to have level ${expectedLogLevel}`);
        }
      }
    }
    
    beforeEach(() => {
      writeStream = new stream.WritableStream();
      logger = GCFLogger["initLogger"]({}, writeStream);
    });

    it('logs an debug level string', () => {
      logger.debug('hello world');
      let loggedLines = getLogsFromStream(writeStream);
      validateLogs(loggedLines,  1, ['hello world'], [], 20);
    });

    it('logs an debug level json', () => {
      logger.debug({ 'hello': 'world'});
      let loggedLines = getLogsFromStream(writeStream);
      validateLogs(loggedLines,  1, [], [{ 'hello': 'world'}], 20);
    });

    it('logs an info level string', () => {
      logger.info('hello world');
      let loggedLines = getLogsFromStream(writeStream);
      validateLogs(loggedLines,  1, ['hello world'], [], 30);
    });

    it('logs an info level json', () => {
      logger.info({ 'hello': 'world'});
      let loggedLines = getLogsFromStream(writeStream);
      validateLogs(loggedLines,  1, [], [{ 'hello': 'world'}], 30);
    });

    it('logs a metric level string', () => {
      logger.metric('hello world');
      let loggedLines = getLogsFromStream(writeStream);
      validateLogs(loggedLines,  1, ['hello world'], [], 30);
    });

    it('logs a metric level json', () => {
      logger.metric({ 'hello': 'world'});
      let loggedLines = getLogsFromStream(writeStream);
      validateLogs(loggedLines,  1, [], [{ 'hello': 'world'}], 30);
    });

    it('logs an warn level string', () => {
      logger.warn('hello world');
      let loggedLines = getLogsFromStream(writeStream);
      validateLogs(loggedLines,  1, ['hello world'], [], 40);
    });

    it('logs an warn level json', () => {
      logger.warn({ 'hello': 'world'});
      let loggedLines = getLogsFromStream(writeStream);
      validateLogs(loggedLines,  1, [], [{ 'hello': 'world'}], 40);
    });

    it('logs an error level string', () => {
      logger.error('hello world');
      let loggedLines = getLogsFromStream(writeStream);
      validateLogs(loggedLines,  1, ['hello world'], [], 50);
    });

    it('logs an error level json', () => {
      logger.error({ 'hello': 'world'});
      let loggedLines = getLogsFromStream(writeStream);
      validateLogs(loggedLines,  1, [], [{ 'hello': 'world'}], 50);
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
        config({path: resolve(__dirname, '../../../.env')});
      });
  
      afterEach(() => {});
  
      it('returns valid options', async () => {
        await bootstrapper.getProbotConfig();
      });
    });
  
    describe('loadProbot', () => {
      let bootstrapper: GCFBootstrapper;
  
      beforeEach(async () => {
        bootstrapper = new GCFBootstrapper();
        config({path: resolve(__dirname, '../../.env')});
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
