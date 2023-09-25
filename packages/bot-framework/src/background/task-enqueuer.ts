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
import {GCFLogger} from '../logging/gcf-logger';

type BotEnvironment = 'functions' | 'run';
export interface BackgroundRequest {
  id: string;
  eventName: string;
  body: string;
  targetEnvironment: BotEnvironment;
  targetName: string;
  delayInSeconds?: number;
  signature: string;
}

export interface TaskEnqueuer {
  enqueueTask(request: BackgroundRequest, logger: GCFLogger): Promise<void>;

  loadTask(request: BotRequest, logger: GCFLogger): Promise<BotRequest>;
}

export class NoopTaskEnqueuer implements TaskEnqueuer {
  async enqueueTask(
    request: BackgroundRequest,
    logger: GCFLogger
  ): Promise<void> {}
  async loadTask(request: BotRequest, logger: GCFLogger): Promise<BotRequest> {
    return request;
  }
}
