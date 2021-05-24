// Copyright 2021 Google LLC
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

import {v1, protos} from '@google-cloud/scheduler';
import {run} from '@googleapis/run';
import {GoogleAuth} from 'google-auth-library';
import {readFileSync, existsSync} from 'fs';
import * as yaml from 'js-yaml';

export interface CronEntry {
  name: string;
  schedule: string;
  description?: string;
  params?: {
    [key: string]: string | number | boolean;
  };
}

interface CronConfig {
  cron?: CronEntry[];
}

/**
 * Fetch the base URL of the serverless-scheduler-proxy instance.
 *
 * @param projectId {string} The project ID that the serverless-scheduler-proxy
 *   runs in
 * @param region {string} The region that the serverless-scheduler-proxy
 *   runs in
 * @returns {string|null} The base http URL of the serverless-scheduler-proxy.
 *   Returns null if it cannot be found.
 */
export async function getServerlessSchedulerProxyUrl(
  projectId: string,
  region: string
): Promise<string | null> {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const authClient = await auth.getClient();
  const client = await run({
    version: 'v1',
    auth: authClient,
  });
  const name = `projects/${projectId}/locations/${region}/services/serverless-scheduler-proxy`;
  const res = await client.projects.locations.services.get({
    name,
  });

  if (res.data.status?.address?.url) {
    return res.data.status.address.url;
  }
  return null;
}

/**
 * Parse multiple cron entries from a `cron.yaml` file. The cron file
 * is a YAML file with a root `cron` field that contains a list of
 * CronEntry data structures.
 * @param path {string} Path to the `cron.yaml` file.
 * @returns {CronEntry[]} The list of parsed cron entries.
 */
export function parseCronEntries(path: string): CronEntry[] {
  if (!existsSync(path)) {
    return [];
  }
  const content = readFileSync(path).toString('utf-8');
  const config = yaml.load(content) as CronConfig;
  return config.cron ?? [];
}

/**
 * Helper to create or update a CronEntry as a Cloud Scheduler Job.
 * @param cronEntry {CronEntry} the cron definition
 * @param projectId {string} The project ID of the Cloud Scheduler Job
 * @param schedulerRegion {string} The region of the Cloud Scheduler Job
 * @param functionRegion {string} The region of the target Cloud Function
 * @param baseTargetUrl {string} The base URL of the serverless-scheduler-proxy
 * @param serviceAccountEmail {string} The service account to authenticate
 *   serverless-scheduler-proxy requests with.
 * @returns {string|null} Returns the job name on success.
 */
export async function createOrUpdateCron(
  cronEntry: CronEntry,
  projectId: string,
  schedulerRegion: string,
  functionRegion: string,
  baseTargetUrl: string,
  serviceAccountEmail: string
): Promise<string | null> {
  console.log('creating or updating cron', cronEntry);
  const client = new v1.CloudSchedulerClient();
  const parent = client.locationPath(projectId, schedulerRegion);
  const jobName = client.jobPath(projectId, schedulerRegion, cronEntry.name);
  const targetUrl = `${baseTargetUrl}/v0`;

  let foundJob;
  try {
    [foundJob] = await client.getJob({name: jobName});
  } catch (e) {
    // error 5 is NOT_FOUND
    if (e.code !== 5) {
      throw e;
    }
  }
  if (foundJob) {
    const updatedJob = {
      ...foundJob,
      schedule: cronEntry.schedule,
      description: cronEntry.description,
      uri: targetUrl,
    };
    const [job] = await client.updateJob({job: updatedJob});
    return job?.name ?? null;
  } else {
    const extraParams = cronEntry.params ?? {};
    const bodyContent = {
      ...extraParams,
      Name: cronEntry.name,
      Type: 'function',
      Location: functionRegion,
    };
    const [job] = await client.createJob({
      parent,
      job: {
        name: jobName,
        schedule: cronEntry.schedule,
        description: cronEntry.description,
        httpTarget: {
          uri: targetUrl,
          httpMethod: protos.google.cloud.scheduler.v1.HttpMethod.POST,
          oidcToken: {
            serviceAccountEmail,
            audience: baseTargetUrl,
          },
          headers: {
            'Content-Type': 'application/json',
          },
          body: Buffer.from(JSON.stringify(bodyContent), 'utf-8'),
        },
        timeZone: 'America/Los_Angeles',
      },
    });
    return job?.name ?? null;
  }
}
