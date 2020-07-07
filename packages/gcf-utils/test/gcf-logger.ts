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
      logger = GCFLogger['initLogger'](undefined, writeStream);
    });

    testAllLevels();
  });
});
