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
//
import pino from 'pino';
import SonicBoom from 'sonic-boom';

type Destination = NodeJS.WritableStream | SonicBoom;
type LogEntry = {[key: string]: unknown};

/**
 * A logger standardized logger for Google Cloud Functions
 */
export class GCFLogger {
  private destination!: Destination;
  private pino!: pino.Logger;

  constructor(customDestination?: Destination) {
    this.initPinoLogger(customDestination);
    this.trace = this.trace.bind(this);
    this.debug = this.debug.bind(this);
    this.info = this.info.bind(this);
    this.warn = this.warn.bind(this);
    this.metric = this.metric.bind(this);
    this.error = this.error.bind(this);
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */

  /**
   * Log at the trace level
   */
  public trace(msg: string, ...args: any[]): void;
  public trace(obj: object, msg?: string, ...args: any[]): void;
  public trace(
    objOrMsg: object | string,
    addMsg?: string,
    ...args: any[]
  ): void {
    this.log('trace', objOrMsg, addMsg, ...args);
  }

  /**
   * Log at the debug level
   */
  public debug(msg: string, ...args: any[]): void;
  public debug(obj: object, msg?: string, ...args: any[]): void;
  public debug(
    objOrMsg: object | string,
    addMsg?: string,
    ...args: any[]
  ): void {
    this.log('debug', objOrMsg, addMsg, ...args);
  }

  /**
   * Log at the info level
   */
  public info(msg: string, ...args: any[]): void;
  public info(obj: object, msg?: string, ...args: any[]): void;
  public info(
    objOrMsg: object | string,
    addMsg?: string,
    ...args: any[]
  ): void {
    this.log('info', objOrMsg, addMsg, ...args);
  }

  /**
   * Log at the warn level
   */
  public warn(msg: string, ...args: any[]): void;
  public warn(obj: object, msg?: string, ...args: any[]): void;
  public warn(
    objOrMsg: object | string,
    addMsg?: string,
    ...args: any[]
  ): void {
    this.log('warn', objOrMsg, addMsg, ...args);
  }

  /**
   * Log at the error level
   */
  public error(msg: string, ...args: any[]): void;
  public error(obj: object, msg?: string, ...args: any[]): void;
  public error(
    objOrMsg: object | string,
    addMsg?: string,
    ...args: any[]
  ): void {
    this.log('error', objOrMsg, addMsg, ...args);
  }

  /**
   * Log at the metric level
   */
  public metric(msg: string, entry: LogEntry | string): void;
  public metric(msg: string, ...args: any[]): void;
  public metric(obj: object, msg?: string, ...args: any[]): void;
  public metric(
    objOrMsg: object | string,
    addMsg?: LogEntry | string,
    ...args: any[]
  ): void {
    let payload: LogEntry = {
      count: 1,
      event: 'unknown',
    };
    if (typeof objOrMsg === 'string') {
      payload.event = objOrMsg;
    } else {
      payload = {...payload, ...objOrMsg};
    }
    if (typeof addMsg === 'object') {
      payload = {...payload, ...addMsg};
      addMsg = undefined;
    }
    this.log('metric', {...payload, type: 'metric'}, addMsg, ...args);
  }

  private log(
    level: string,
    objOrMsg: object | string,
    addMsg?: string,
    ...args: any[]
  ): void {
    if (typeof objOrMsg === 'object') {
      this.pino[level](objOrMsg, addMsg, ...args);
    } else {
      this.pino[level](objOrMsg, ...args);
    }
  }

  /* eslint-enable @typescript-eslint/no-explicit-any */

  /**
   * Synchronously flush the buffer for this logger.
   * NOTE: Only supported for SonicBoom destinations
   */
  public flushSync() {
    if (this.destination instanceof SonicBoom) {
      this.destination.flushSync();
    }
  }

  /**
   * Adds static properties to all logs
   * @param properties static properties to bind
   */
  public addBindings(properties: object) {
    this.pino = this.pino.child(properties);
  }

  /**
   * Return the current bindings
   */
  public getBindings(): object {
    return this.pino.bindings();
  }

  /**
   * Remove all current property bindings
   */
  public resetBindings() {
    // Pino provides no way to remove bindings
    // so we have to throw away the old logger
    this.initPinoLogger(this.destination);
  }

  private initPinoLogger(dest?: Destination) {
    const defaultOptions = this.getPinoConfig();
    this.destination = dest || pino.destination({sync: true});
    this.pino = pino(defaultOptions, this.destination);
  }

  private getPinoConfig(): pino.LoggerOptions {
    return {
      formatters: {
        level: pinoLevelToCloudLoggingSeverity,
      },
      customLevels: {
        metric: 30,
      },
      base: null,
      messageKey: 'message',
      timestamp: false,
      level: 'trace',
    };
  }
}

/**
 * Maps Pino's number-based levels to Google Cloud Logging's string-based severity.
 * This allows Pino logs to show up with the correct severity in Logs Viewer.
 * Also preserves the original Pino level
 * @param label the label used by Pino for the level property
 * @param level the numbered level from Pino
 */
function pinoLevelToCloudLoggingSeverity(
  label: string,
  level: number
): {[label: string]: number | string} {
  const severityMap: {[level: number]: string} = {
    10: 'DEBUG',
    20: 'DEBUG',
    30: 'INFO',
    40: 'WARNING',
    50: 'ERROR',
  };
  const UNKNOWN_SEVERITY = 'DEFAULT';
  return {severity: severityMap[level] || UNKNOWN_SEVERITY, level: level};
}
