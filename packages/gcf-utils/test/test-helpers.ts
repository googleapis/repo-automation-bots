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

import assert from 'assert';

export const logLevels: {
  [index: string]: {pino: number; cloudLogging: string};
} = {
  trace: {
    pino: 10,
    cloudLogging: 'DEBUG',
  },
  debug: {
    pino: 20,
    cloudLogging: 'DEBUG',
  },
  info: {
    pino: 30,
    cloudLogging: 'INFO',
  },
  metric: {
    pino: 30,
    cloudLogging: 'INFO',
  },
  warn: {
    pino: 40,
    cloudLogging: 'WARNING',
  },
  error: {
    pino: 50,
    cloudLogging: 'ERROR',
  },
};

export interface LogLine {
  msg: string;
  level: number;
  [index: string]: string | number;
}

const MESSAGE_KEY = 'message';
const PINO_LEVEL_KEY = 'level';
const CLOUD_LOGGING_SEVERITY_KEY = 'severity';

/**
 * Asserts the correctness of the provided log entries based on params given
 * @param logs logged lines
 * @param expectedLineCount expected number of log lines
 * @param expectedMessages expected messages in each line (in order of log lines)
 * @param expectedProperties expected properties and values in each line (in order of log lines)
 * @param expectedLogLevel expected log level for all lines
 */
export function validateLogs(
  logs: LogLine[],
  expectedLineCount?: number,
  expectedMessages?: string[],
  expectedProperties?: Array<{[idx: string]: string | number}>,
  expectedLogLevel?: {pino: number; cloudLogging: string}
): void {
  if (expectedLineCount) {
    assert.equal(
      logs.length,
      expectedLineCount,
      `expected exactly ${expectedLineCount} line(s) to be logged`
    );
  }
  if (expectedMessages) {
    for (let i = 0; i < expectedMessages.length; i++) {
      assert.equal(
        logs[i][MESSAGE_KEY],
        expectedMessages[i],
        `expected log message to be ${expectedMessages[i]} but was instead ${logs[i][MESSAGE_KEY]}`
      );
    }
  }
  if (expectedProperties) {
    for (let i = 0; i < expectedProperties.length; i++) {
      for (const key of Object.keys(expectedProperties[i])) {
        assert.equal(
          logs[i][key],
          expectedProperties[i][key],
          `expected log line ${i} to have property ${key} with value ${expectedProperties[i][key]}`
        );
      }
    }
  }
  if (expectedLogLevel) {
    for (const line of logs) {
      assert.equal(
        line[PINO_LEVEL_KEY],
        expectedLogLevel.pino,
        `expected logs to have Pino level ${expectedLogLevel.pino}`
      );
      assert.equal(
        line[CLOUD_LOGGING_SEVERITY_KEY],
        expectedLogLevel.cloudLogging,
        `expected logs to have Cloud Logging Severity ${expectedLogLevel.cloudLogging}`
      );
    }
  }
}
