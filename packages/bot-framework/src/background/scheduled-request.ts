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

import {BotRequest} from '../bot-request';
import {AppInstallation, InstalledRepository} from '../installations';

type CronType = 'repository' | 'installation' | 'global';
export const DEFAULT_CRON_TYPE: CronType = 'repository';

export interface ScheduledRequest {
  repo?: string;
  installation: {
    id: number;
  };
  message?: {[key: string]: string};
  cron_type?: CronType;
  cron_org?: string;
  allowed_organizations?: string[];
}

export function parseScheduledRequest(
  botRequest: BotRequest
): ScheduledRequest {
  let body = JSON.parse(
    botRequest.rawBody.toString('utf8')
  ) as ScheduledRequest;
  // PubSub messages have their payload encoded in body.message.data
  // as a base64 blob.
  if (body.message && body.message.data) {
    body = JSON.parse(Buffer.from(body.message.data, 'base64').toString());
  }
  return body;
}

export function scheduledRequestWithInstallation(
  scheduledRequest: ScheduledRequest,
  appInstallation: AppInstallation
): ScheduledRequest {
  const extraParams: ScheduledRequest = {
    installation: {
      id: appInstallation.id,
    },
  };
  if (appInstallation.targetType === 'Organization' && appInstallation.login) {
    extraParams.cron_org = appInstallation.login;
  }
  return {
    ...scheduledRequest,
    ...extraParams,
  };
}

export function scheduledRequestWithInstalledRepository(
  scheduledRequest: ScheduledRequest,
  installedRepository: InstalledRepository
): ScheduledRequest {
  return {
    ...scheduledRequest,
    ...buildRepositoryDetails(installedRepository.fullName),
  };
}

export function scheduledRequestWithRepository(
  scheduledRequest: ScheduledRequest,
  repositoryFullName: string
): ScheduledRequest {
  return {
    ...scheduledRequest,
    ...buildRepositoryDetails(repositoryFullName),
  };
}

function buildRepositoryDetails(repoFullName: string): {} {
  const [orgName, repoName] = repoFullName.split('/');
  return {
    repository: {
      name: repoName,
      full_name: repoFullName,
      owner: {
        login: orgName,
        name: orgName,
      },
    },
    organization: {
      login: orgName,
    },
  };
}
