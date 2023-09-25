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
import crypto from 'crypto';
import {BotRequest, TriggerType} from '../bot-request';

/**
 * Information on GCF execution trigger
 */
interface TriggerInfo {
  trigger: {
    trigger_type: TriggerType;
    trigger_sender?: string;

    /**
     * We include a payload hash for GitHub webhook triggers
     * to be able to map the webhook to the GitHub Event
     * since they share the same payload
     */
    payload_hash?: string;
    github_delivery_guid?: string;
    github_event_type?: string;

    trigger_source_repo?: {
      owner: string;
      owner_type: string;
      repo_name: string;
      url: string;
    };
  };
}

/**
 * Build a TriggerInfo object for this execution
 * @param triggerType trigger type for this exeuction
 * @param githubDeliveryGUID github delivery id for this exeuction
 * @param githubEventName the value of the X-GitHub-Event header
 * @param requestBody body of the incoming trigger request
 */
export function buildTriggerInfo(
  botRequest: BotRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requestBody: {[key: string]: any} = {}
): TriggerInfo {
  const UNKNOWN = 'UNKNOWN';

  const triggerInfo: TriggerInfo = {
    trigger: {
      trigger_type: botRequest.triggerType,
    },
  };

  if (
    botRequest.triggerType === TriggerType.GITHUB ||
    botRequest.triggerType === TriggerType.TASK
  ) {
    triggerInfo.trigger.github_delivery_guid = botRequest.githubDeliveryId;

    const webhookProperties = {
      trigger_source_repo: getRepositoryDetails(requestBody),
      trigger_sender: requestBody.sender?.login || UNKNOWN,
      payload_hash: getPayloadHash(requestBody),
      github_event_type: getEventTypeDetails(
        botRequest.eventName,
        requestBody.action
      ),
    };
    triggerInfo.trigger = {...webhookProperties, ...triggerInfo.trigger};
  }

  return triggerInfo;
}

/**
 * Parses GitHub event's source repository details
 * @param requestBody the body of the incoming GitHub Webhook request
 */
function getRepositoryDetails(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requestBody: {[key: string]: any}
): {
  repo_name: string;
  owner: string;
  owner_type: string;
  url: string;
} {
  const UNKNOWN = 'UNKNOWN';

  const sourceRepo = requestBody['repository'] || {};
  const repoName: string = sourceRepo['name'] || UNKNOWN;

  const repoOwner = sourceRepo['owner'] || {};
  const ownerName: string = repoOwner['login'] || UNKNOWN;
  const ownerType: string = repoOwner['type'] || UNKNOWN;

  const repoIsKnown = repoName !== UNKNOWN && ownerName !== UNKNOWN;
  const url: string = repoIsKnown
    ? `https://github.com/${ownerName}/${repoName}`
    : UNKNOWN;

  return {
    repo_name: repoName,
    owner: ownerName,
    owner_type: ownerType,
    url: url,
  };
}

/**
 * Returns a description of the GitHub Event type
 * @param requestBody the body of the incoming GitHub Webhook request
 */
function getEventTypeDetails(eventName: string, actionValue: string): string {
  eventName = eventName === '' ? 'UNKNOWN' : eventName;
  return `${eventName}${actionValue ? `.${actionValue}` : ''}`;
}

/**
 * Return a hash of the GitHub Webhook Payload
 * @param requestBody the body of the incoming GitHub Webhook request
 */
function getPayloadHash(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requestBody: {[key: string]: any}
): string {
  const dontHash = ['repository', 'sender', 'installation'];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const toHash: {[key: string]: any} = {};
  for (const prop of Object.keys(requestBody)) {
    if (!dontHash.includes(prop)) {
      toHash[prop] = requestBody[prop];
    }
  }
  return crypto.createHash('md5').update(JSON.stringify(toHash)).digest('hex');
}
