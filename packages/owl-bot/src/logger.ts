// Copyright 2022 Google LLC
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

// Wrapping the console which takes any params.
/* eslint-disable @typescript-eslint/no-explicit-any */

/** A logging interface that's compatible with console. */
export interface Logger {
  log(msg: any, ...params: any[]): void;
  error(msg: any, ...params: any[]): void;
  warn(msg: any, ...params: any[]): void;
  info(msg: any, ...params: any[]): void;
}

/** Insert a timestamp into a log function's arguments. */
export function insertTimestamp(msg: any, params: any[]): [any, any[]] {
  const dateString = new Date().toISOString();
  if (typeof msg === 'string') {
    return [`${dateString} ${msg}`, params];
  } else {
    return [dateString, [msg, ...params]];
  }
}

export class LoggerWithTimestamp implements Logger {
  inner: Logger;
  constructor(inner: Logger) {
    this.inner = inner;
  }
  log(msg: any, ...params: any[]): void {
    const [innerMsg, innerParams] = insertTimestamp(msg, params);
    this.inner.log(innerMsg, ...innerParams);
  }
  error(msg: any, ...params: any[]): void {
    const [innerMsg, innerParams] = insertTimestamp(msg, params);
    this.inner.error(innerMsg, ...innerParams);
  }
  warn(msg: any, ...params: any[]): void {
    const [innerMsg, innerParams] = insertTimestamp(msg, params);
    this.inner.warn(innerMsg, ...innerParams);
  }
  info(msg: any, ...params: any[]): void {
    const [innerMsg, innerParams] = insertTimestamp(msg, params);
    this.inner.info(innerMsg, ...innerParams);
  }
}
