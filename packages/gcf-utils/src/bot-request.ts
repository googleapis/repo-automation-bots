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

import * as express from 'express';
import {SCHEDULER_EVENT_NAMES} from './custom-events';

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
  signature?: string;
  taskName?: string;
  taskRetryCount?: number;
  traceId?: string;
  triggerType: TriggerType;
}

export function parseBotRequest(request: express.Request): BotRequest {
  const eventName =
    request.get('x-github-event') || request.get('X-GitHub-Event') || '';
  const githubDeliveryId =
    request.get('x-github-delivery') || request.get('X-GitHub-Delivery') || '';
  const signature = parseSignatureHeader(request);
  const taskName =
    request.get('X-CloudTasks-TaskName') ||
    request.get('x-cloudtasks-taskname');
  const taskRetryCount = parseInt(
    request.get('X-CloudTasks-TaskRetryCount') ||
      request.get('x-cloudtasks-taskretrycount') ||
      '0'
  );
  const triggerType = parseTriggerType(eventName, taskName);
  const traceId =
    request.get('X-Cloud-Trace-Context') ||
    request.get('x-cloud-trace-context');
  return {
    eventName,
    githubDeliveryId,
    signature,
    taskName,
    taskRetryCount,
    traceId,
    triggerType,
  };
}

/**
 * Determine the type of trigger that started this execution
 * @param eventName event name from header
 * @param taskName task id from header
 */
function parseTriggerType(eventName: string, taskName: string): TriggerType {
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
  const sha1Signature =
    request.get('x-hub-signature') || request.get('X-Hub-Signature');
  if (sha1Signature) {
    return sha1Signature;
  }
  return 'unset';
}
