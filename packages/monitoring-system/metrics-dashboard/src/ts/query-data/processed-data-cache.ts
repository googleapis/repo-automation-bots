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

/**
 * Processed data for Bot Executions
 */
interface ExecutionsCache {
  /**
   * Count of number of executions by bot
   */
  countByBot: {
    [botName: string]: number;
  };
}

interface ActionsCache {
  actionInfos: {
    [primaryKey: string]: ActionInfo;
  };
}

/**
 * GitHub Action information
 */
export interface ActionInfo {
  repoName: string;
  time: string;
  url: string;
  description: string;
}

interface ErrorCache {
  errorInfos: {
    [primaryKey: string]: ErrorInfo;
  };
}

/**
 * Bot Execution Error Information
 */
export interface ErrorInfo {
  msg: string;
  time: string;
  logsUrl: string;
  botName: string;
}

/**
 * Caches query data that has already been processed
 */
export class ProcessedDataCache {
  static Executions: ExecutionsCache = {
    countByBot: {},
  };

  static Actions: ActionsCache = {
    actionInfos: {},
  };

  static Errors: ErrorCache = {
    errorInfos: {},
  };

  static currentFilterTriggers = {
    docs: {},
    countByType: {},
  };
}
