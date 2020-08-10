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

export const logger = initLogger();

/**
 * Initializes a Pino logger
 */
function initLogger(): pino.Logger {
  const DEFAULT_LOG_LEVEL = 'trace';
  const defaultOptions: pino.LoggerOptions = {
    formatters: {
      level: pinoLevelToCloudLoggingSeverity,
    },
    base: null,
    messageKey: 'message',
    timestamp: false,
    level: DEFAULT_LOG_LEVEL,
  };

  const dest = pino.destination({sync: true});
  return pino(defaultOptions, dest);
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
