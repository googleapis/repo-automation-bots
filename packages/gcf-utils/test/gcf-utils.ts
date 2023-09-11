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

/* eslint-disable @typescript-eslint/no-var-requires */

import {ERROR_REPORTING_TYPE_NAME, logErrors} from '../src/gcf-utils';
import {GCFLogger} from '../src/logging/gcf-logger';
import {ObjectWritableMock} from 'stream-mock';
import {describe, beforeEach, it} from 'mocha';
import * as assert from 'assert';
import {LogLine} from './test-helpers';

describe('logErrors', () => {
  let destination: ObjectWritableMock;
  let logger: GCFLogger & {[key: string]: Function};

  function readLogsAsObjects(writeStream: ObjectWritableMock): LogLine[] {
    try {
      writeStream.end();
      const lines: string[] = writeStream.data;
      return lines.map(line => JSON.parse(line));
    } catch (error) {
      throw new Error(`Failed to read stream: ${error}`);
    }
  }

  beforeEach(() => {
    destination = new ObjectWritableMock();
    logger = new GCFLogger(destination) as GCFLogger & {
      [key: string]: Function;
    };
  });

  it('adds @type property to the log entry', () => {
    logErrors(logger, new Error('An error happened'));
    const loggedLines: LogLine[] = readLogsAsObjects(destination);
    assert.strictEqual(loggedLines[0]['@type'], ERROR_REPORTING_TYPE_NAME);
  });
});
