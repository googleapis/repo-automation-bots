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

import {
  isObject,
  isStringIndexed,
  isString,
  hasStringProperties,
  hasObjectProperties,
} from './type-check-util';

/**
 * Categories of incoming log messages
 */
export enum LogEntryType {
  EXECUTION_START,
  EXECUTION_END,
  TRIGGER_INFO,
  GITHUB_ACTION,
  ERROR,
  NON_METRIC,
  MALFORMED,
}

/**
 * Cloud Logging / Stackdriver log entry structure
 */
export interface LogEntry {
  [key: string]: any; // logs may have other properties
  insertId: string;
  jsonPayload?: GCFLoggerJsonPayload;
  textPayload?: string;
  resource: {
    type: string;
    labels: {
      function_name: string;
      project_id: string;
      region: string;
    };
  };
  timestamp: string;
  severity: string;
  labels: {
    execution_id: string;
  };
  logName: string;
  trace: string;
  receiveTimestamp: string;
}

/**
 * The default structure of a GCFLogger JSON payload
 */
export interface GCFLoggerJsonPayload {
  [key: string]: any; // payload may have other properties
  level: number;
  message?: string;
}

/**
 * JSON Payload for trigger information logs
 */
export interface TriggerInfoPayload extends GCFLoggerJsonPayload {
  message: string;
  trigger: {
    trigger_type: string;
    trigger_sender?: string;
    github_delivery_guid?: string;
    payload_hash?: string;
    trigger_source_repo?: {
      owner: string;
      owner_type: string;
      repo_name: string;
      url: string;
    };
  };
}

/**
 * JSON Payload for GitHub action logs
 */
export interface GitHubActionPayload extends GCFLoggerJsonPayload {
  action: {
    type: string;
    value: string;
    destination_object?: {
      object_type: string;
      object_id: string | number;
    };
    destination_repo: {
      repo_name: string;
      owner: string;
    };
  };
}

/**
 * Determines the LogEntryType for the given LogEntry
 *
 * @param entry LogEntry to parse
 */
export function parseLogEntryType(entry: LogEntry): LogEntryType {
  try {
    if (isErrorLog(entry)) {
      return LogEntryType.ERROR;
    }
    if (isExecutionStartEntry(entry)) {
      return LogEntryType.EXECUTION_START;
    }
    if (isExecutionEndEntry(entry)) {
      return LogEntryType.EXECUTION_END;
    }
    if (isTriggerInfoEntry(entry)) {
      return LogEntryType.TRIGGER_INFO;
    }
    if (isGitHubActionEntry(entry)) {
      return LogEntryType.GITHUB_ACTION;
    }
    return LogEntryType.NON_METRIC;
  } catch (error) {
    return LogEntryType.MALFORMED;
  }
}

/**
 * Check if the given log entry is of type ERROR
 * @param entry entry to check
 */
export function isErrorLog(entry: LogEntry): boolean {
  const ERRORONEOUS_SEVERITIES = ['ERROR', 'CRITICAL', 'ALERT', 'EMERGENCY'];
  return ERRORONEOUS_SEVERITIES.includes(entry.severity);
}

/**
 * Check if the given log entry is of type EXECUTION_START
 * @param entry entry to check
 */
export function isExecutionStartEntry(entry: LogEntry): boolean {
  const REGEX = /Function execution started/;
  return !!entry.textPayload?.match(REGEX);
}

/**
 * Check if the given log entry is of type EXECUTION_END
 * @param entry entry to check
 */
export function isExecutionEndEntry(entry: LogEntry): boolean {
  const REGEX = /Function execution took [0-9]{1,2} ms, finished with status code: [0-9]{3}/;
  return !!entry.textPayload?.match(REGEX);
}

/**
 * Check if the given log entry is of type TRIGGER_INFO
 * @param entry entry to check
 * @throws if the jsonPayload has a 'trigger' property but the
 * payload is not a valid TriggerInfoPayload
 */
function isTriggerInfoEntry(entry: LogEntry): boolean {
  const payload = entry.jsonPayload;
  if (!payload) {
    return false;
  }

  const isTriggerPayload = isTriggerInfoPayload(payload);
  if (payload['trigger'] && !isTriggerPayload) {
    throw new Error(
      "jsonPayload has 'trigger' property but" +
        'is not a valid trigger info log entry'
    );
  }

  return isTriggerPayload;
}

/**
 * Returns true if the given payload implements TriggerInfoPayload
 * @param payload payload to check
 */
export function isTriggerInfoPayload(
  payload: object
): payload is TriggerInfoPayload {
  if (!isObject(payload) || !isStringIndexed(payload)) {
    return false;
  }
  if (!payload.message || !isString(payload.message)) {
    return false;
  }

  const trigger = payload.trigger;
  if (!isObject(trigger) || !isStringIndexed(trigger)) {
    return false;
  }
  if (!trigger.trigger_type || !isString(trigger.trigger_type)) {
    return false;
  }

  const optionalStringProps = [
    'trigger_sender',
    'github_delivery_guid',
    'payload_hash',
  ];
  for (const prop of optionalStringProps) {
    if (trigger[prop] && !isString(trigger[prop])) {
      return false;
    }
  }

  const sourceRepo = trigger.trigger_source_repo;
  if (sourceRepo) {
    if (!isObject(sourceRepo) || !isStringIndexed(sourceRepo)) {
      return false;
    }
    const stringProps = ['owner', 'owner_type', 'repo_name', 'url'];
    if (!hasStringProperties(sourceRepo, stringProps)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if the given log entry is of type GITHUB_ACTION
 * @param entry entry to check
 * @throws if the jsonPayload has an 'action' property but the
 * payload is not a valid GitHubActionPayload
 */
export function isGitHubActionEntry(entry: LogEntry): boolean {
  const payload = entry.jsonPayload;

  if (!payload) {
    return false;
  }

  const isActionPayload = isGitHubActionPayload(payload);
  if (payload['action'] && !isActionPayload) {
    throw new Error(
      "jsonPayload has 'action' property but" +
        'is not a valid GitHub action log entry'
    );
  }

  return isActionPayload;
}

/**
 * Returns true if the given payload implements GitHubActionPayload
 * @param payload payload to check
 */
export function isGitHubActionPayload(
  payload: object
): payload is GitHubActionPayload {
  if (!isObject(payload) || !isStringIndexed(payload)) {
    return false;
  }

  const action = payload.action;
  if (!isObject(action) || !isStringIndexed(action)) {
    return false;
  }
  if (!hasStringProperties(action, ['type', 'value'])) {
    return false;
  }
  if (!hasObjectProperties(action, ['destination_repo'])) {
    return false;
  }

  const dstRepo = action.destination_repo;
  if (!hasStringProperties(dstRepo, ['repo_name', 'owner'])) {
    return false;
  }

  const dstObj = action.destination_object;
  if (dstObj) {
    if (!dstObj.object_type || !isString(dstObj.object_type)) {
      return false;
    }
    if (
      !dstObj.object_id ||
      !['string', 'number'].includes(typeof dstObj.object_id)
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Determines if the given object is of type LogEntry
 * @param toCheck object to check
 * @returns true if object is a LogEntry, false otherwise
 */
export function instanceOfLogEntry(toCheck: object): toCheck is LogEntry {
  if (!isStringIndexed(toCheck)) {
    return false;
  }

  const topLevelStringProps = [
    'insertId',
    'timestamp',
    'severity',
    'logName',
    'trace',
    'receiveTimestamp',
  ];
  if (
    !hasStringProperties(toCheck, topLevelStringProps) ||
    !hasObjectProperties(toCheck, ['resource', 'labels'])
  ) {
    return false;
  }

  const validJSONPayload =
    toCheck.jsonPayload && isStringIndexed(toCheck.jsonPayload);
  const validTextPayload = toCheck.textPayload && isString(toCheck.textPayload);
  if (!validJSONPayload && !validTextPayload) {
    return false;
  }

  const resource = toCheck.resource;
  if (!resource.type || !isString(resource.type)) {
    return false;
  }
  if (!resource.labels || !isObject(resource.labels)) {
    return false;
  }

  const resourceLabelProperties = ['function_name', 'project_id', 'region'];
  if (!hasStringProperties(resource.labels, resourceLabelProperties)) {
    return false;
  }

  const execution_id = toCheck.labels.execution_id;
  if (!execution_id || !isString(execution_id)) {
    return false;
  }

  return true;
}
