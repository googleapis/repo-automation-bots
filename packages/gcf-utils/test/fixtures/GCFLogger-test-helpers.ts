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

import assert from 'assert';
import { ObjectWritableMock } from 'stream-mock';

/**
 * Asserts the correctness of the provided log entries based on params given
 * @param logs logged lines
 * @param expectedLineCount expected number of log lines
 * @param expectedMessages expected messages in each line (in order of log lines)
 * @param expectedProperties expected properties and values in each line (in order of log lines)
 * @param expectedLogLevel expected log level for all lines
 */
export function validateLogs(
    logs: any[],
    expectedLineCount?: number,
    expectedMessages?: string[],
    expectedProperties?: Array<{ [idx: string]: any }>,
    expectedLogLevel?: number
): void {
    if (expectedLineCount) {
        assert.equal(logs.length, expectedLineCount,
            `expected exactly ${expectedLineCount} line(s) to be logged`);
    }
    if (expectedMessages) {
        for (let i = 0; i < expectedMessages.length; i++) {
            assert.equal(logs[i]["msg"], expectedMessages[i],
                `expected log message to be ${expectedMessages[i]} but was instead ${logs[i]["msg"]}`);
        }
    }
    if (expectedProperties) {
        for (let i = 0; i < expectedProperties.length; i++) {
            for (let key of Object.keys(expectedProperties[i])) {
                assert.equal(logs[i][key], expectedProperties[i][key],
                    `expected log line ${i} to have property ${key} with value ${expectedProperties[i][key]}`);
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

/**
 * Parses logs written to a stream
 * @param writeStream stream containing logs
 */
export function getLogsFromStream(writeStream: NodeJS.WritableStream): any[] {
    try {
        writeStream.end();
        let lines: string[];
        if (writeStream instanceof ObjectWritableMock) {
            lines = writeStream.data;
        } else {
            let stringData: string = writeStream.toString();
            console.log(stringData);
            lines = stringData.split('\n').filter((line) => line != null && line !== '');
        }
        let jsonArray: any[] = lines.map((line) => JSON.parse(line));
        return jsonArray;
    } catch (error) {
        throw new Error(`Failed to read stream: ${error}`);
    }
}