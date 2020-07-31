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
import {TriggerType} from './gcf-utils';

/**
 * Information on GCF execution trigger
 */
export interface TriggerInfo {
  trigger: {
    trigger_type: TriggerType;
    trigger_sender?: string;
    github_delivery_guid?: string;
    trigger_source_repo?: {
      owner: string;
      owner_type: string;
      repo_name: string;
    };
    message: string;
  };
}

/**
 * Build a TriggerInfo object for this execution
 * @param triggerType trigger type for this exeuction
 * @param github_delivery_guid github delivery id for this exeuction
 * @param requestBody body of the incoming trigger request
 */
export function buildTriggerInfo(
  triggerType: TriggerType,
  github_delivery_guid: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  requestBody: {[key: string]: any}
): TriggerInfo {
  const triggerInfo: TriggerInfo = {
    trigger: {
      trigger_type: triggerType,
      message: `Execution started by ${triggerType}`,
    },
  };

  if (triggerType === TriggerType.GITHUB || triggerType === TriggerType.TASK) {
    triggerInfo.trigger.github_delivery_guid = github_delivery_guid;
  }

  if (triggerType === TriggerType.GITHUB) {
    const sourceRepo = requestBody['repository'] || {};
    const repoName: string = sourceRepo['name'] || 'UNKNOWN';
    const repoOwner = sourceRepo['owner'] || {};
    const ownerName: string = repoOwner['login'] || 'UNKNOWN';
    const ownerType: string = repoOwner['type'] || 'UNKNOWN';
    const sender = requestBody['sender'] || {};
    const senderLogin: string = sender['login'] || 'UNKNOWN';

    const webhookProperties = {
      trigger_source_repo: {
        repo_name: repoName,
        owner: ownerName,
        owner_type: ownerType,
      },
      trigger_sender: senderLogin,
    };

    triggerInfo.trigger = {...webhookProperties, ...triggerInfo.trigger};
  }

  return triggerInfo;
}
