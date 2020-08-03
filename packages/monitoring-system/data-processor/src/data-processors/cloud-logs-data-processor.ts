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
import {DataProcessor, ProcessorOptions} from './data-processor-abstract';
import {Subscription} from '@google-cloud/pubsub';
import {PubsubMessage} from '@google-cloud/pubsub/build/src/publisher';

export interface CloudLogsProcessorOptions extends ProcessorOptions {
  subscription: Subscription;
}

/**
 * Categories of incoming log messages
 */
enum LogType {
  EXECUTION_START,
  EXECUTION_END,
  TRIGGER_INFO,
  GITHUB_ACTION,
  ERROR,
  MALFORMED,
  OTHER,
}

/**
 * Cloud Logging / Stackdriver log statement structure
 */
interface LogMessage {
  [key: string]: any; // logs may have other unexpected properties
  insertId: string;
  jsonPayload?: GCFLoggerJsonPayload | {};
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
interface GCFLoggerJsonPayload {
  level: number;
  message?: string;
}

interface TriggerInfoPayload extends GCFLoggerJsonPayload {
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
 * Pull new logs via a PubSub queue and process them
 */
export class CloudLogsProcessor extends DataProcessor {
  private subscription: Subscription;

  /**
   * Create a Cloud Logs processor instance
   * @param options cloud logs processor options
   */
  constructor(options: CloudLogsProcessorOptions) {
    super(options);
    this.subscription = options.subscription;
  }

  /**
   * Start the collection and processing task
   */
  public async collectAndProcess(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  private async pubSubMessageHandler(message: PubsubMessage) {
    throw new Error('Method not implemented.');
  }
}
