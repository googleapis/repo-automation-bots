// Copyright 2023 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as express from 'express';
import {SCHEDULER_EVENT_NAMES} from './custom-events';
import {HandlerRequest} from './bootstrapper';

/**
 * Type of function execution trigger
 */
export enum TriggerType {
  GITHUB = 'GitHub Webhook',
  SCHEDULER = 'Cloud Scheduler',
  TASK = 'Cloud Task',
  PUBSUB = 'Pub/Sub',
  UNKNOWN = 'Unknown',
}

export interface BotRequest {
  eventName: string;
  githubDeliveryId: string;
  signature: string;
  taskName?: string;
  taskRetryCount: number;
  traceId?: string;
  triggerType: TriggerType;
  rawBody: Buffer;
  payload: object;
}

export function parseBotRequest(request: HandlerRequest): BotRequest {
  const eventName = request.get('X-GitHub-Event') || '';
  const githubDeliveryId = request.get('X-GitHub-Delivery') || '';
  const signature = parseSignatureHeader(request);
  const taskName = request.get('X-CloudTasks-TaskName');
  const taskRetryCount = parseInt(
    request.get('X-CloudTasks-TaskRetryCount') || '0'
  );
  const triggerType = parseTriggerType(eventName, taskName);
  const traceId = parseTraceId(request);
  return {
    eventName,
    githubDeliveryId,
    signature,
    taskName,
    taskRetryCount,
    traceId,
    triggerType,
    rawBody: request.rawBody,
    payload: request.body,
  };
}

/**
 * Determine the type of trigger that started this execution
 * @param eventName event name from header
 * @param taskName task id from header
 */
function parseTriggerType(eventName: string, taskName?: string): TriggerType {
  if (!taskName && SCHEDULER_EVENT_NAMES.includes(eventName)) {
    return TriggerType.SCHEDULER;
  } else if (!taskName && eventName === 'pubsub.message') {
    return TriggerType.PUBSUB;
  } else if (!taskName && eventName) {
    return TriggerType.GITHUB;
  } else if (eventName) {
    return TriggerType.TASK;
  }
  return TriggerType.UNKNOWN;
}

/**
 * Parse the signature from the request headers.
 *
 * If the expected header is not set, returns `unset` because the verification
 * function throws an exception on empty string when we would rather
 * treat the error as an invalid signature.
 * @param request incoming trigger request
 */
function parseSignatureHeader(request: express.Request): string {
  const sha1Signature = request.get('X-Hub-Signature');
  if (sha1Signature) {
    return sha1Signature;
  }
  return 'unset';
}

/**
 * Parse the trace id from the trace context header. The format of the header
 * looks something like `<trace-id>/<span-id>;o=<options-flags>`.
 * @param request incoming trigger request
 */
function parseTraceId(request: express.Request): string | undefined {
  const traceContext = request.get('X-Cloud-Trace-Context');
  if (!traceContext) {
    return undefined;
  }

  const parts = traceContext.split('/');
  if (parts.length === 0 || !parts[0]) {
    return undefined;
  }

  return parts[0];
}
