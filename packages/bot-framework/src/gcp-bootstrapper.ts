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

import {
  BotEnvironment,
  BootstrapperLoadOptions,
  Bootstrapper,
} from './bootstrapper';
import {CloudStoragePayloadCache} from './background/cloud-storage-payload-cache';
import {NoopPayloadCache} from './background/payload-cache';
import {GoogleSecretLoader} from './secrets/google-secret-loader';
import {CloudTasksEnqueuer} from './background/cloud-tasks-enqueuer';

const DEFAULT_TASK_TARGET_ENVIRONMENT: BotEnvironment = 'functions';
const DEFAULT_TASK_CALLER =
  'task-caller@repo-automation-bots.iam.gserviceaccount.com';

export class GCPBootstrapper {
  static async load(
    options: BootstrapperLoadOptions = {}
  ): Promise<Bootstrapper> {
    const projectId = options.projectId ?? process.env.PROJECT_ID;
    if (!projectId) {
      throw new Error(
        'Need to specify a project ID explicitly or via PROJECT_ID env variable'
      );
    }
    const botName = options.botName ?? process.env.GCF_SHORT_FUNCTION_NAME;
    if (!botName) {
      throw new Error(
        'Need to specify a bot name explicitly or via GCF_SHORT_FUNCTION_NAME env variable'
      );
    }
    const location = options.location ?? process.env.GCF_LOCATION;
    if (!location) {
      throw new Error(
        'Missing required `location`. Please provide as a constructor argument or set the GCF_LOCATION env variable.'
      );
    }
    const payloadBucket = options.payloadBucket ?? process.env.WEBHOOK_TMP;
    const payloadCache = payloadBucket
      ? new CloudStoragePayloadCache(payloadBucket)
      : new NoopPayloadCache();
    const secretLoader =
      options.secretLoader ?? new GoogleSecretLoader(projectId);
    const botSecrets = await secretLoader.load(botName);
    const taskCaller = options.taskCaller ?? DEFAULT_TASK_CALLER;
    return new Bootstrapper({
      ...options,
      projectId,
      botSecrets,
      botName,
      payloadCache,
      taskEnqueuer: new CloudTasksEnqueuer(
        projectId,
        botName,
        location,
        taskCaller,
        options.taskTargetEnvironment ?? DEFAULT_TASK_TARGET_ENVIRONMENT,
        options.taskTargetName ?? botName
      ),
    });
  }
}
