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
  /**
   * The PubSub subscription to listen to
   */
  subscription: Subscription;

  /**
   * The time (in seconds) for which the processor should listen
   * for new messages per task run.
   * 
   * Note: Cloud Run tasks can run for a maximum of 15 minutes
   * (900 seconds) but it is not recommended to set this as the 
   * listenLimit - once the processor stops listening it must
   * still finish processing the pending messages.
   */
  listenLimit: number;
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
interface LogEntry {
  [key: string]: any; // logs may have other properties
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
  [key: string]: any; // payload may have other properties
  level: number;
  message?: string;
}

/**
 * JSON Payload for trigger information logs
 */
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
 * JSON Payload for GitHub action logs
 */
interface GitHubActionPayload extends GCFLoggerJsonPayload {
  action: {
    type: string;
    value: string;
    destination_object?: {
      object_type: string;
      object_id: string | number;
    };
    destination_repo: {
      repo_name: string;
      owner: string;
    };
  };
}


/**
 * Pull new logs via a PubSub queue and process them
 */
export class CloudLogsProcessor extends DataProcessor {

  private messagesBeingProcessed: Promise<void>[] = [];
  private subscription: Subscription;
  private listenLimit: number;

  /**
   * Create a Cloud Logs processor instance
   * @param options cloud logs processor options
   */
  constructor(options: CloudLogsProcessorOptions) {
    super(options);
    this.subscription = options.subscription;
    this.listenLimit = options.listenLimit;
  }

  /**
   * Start the collection and processing task
   */
  public async collectAndProcess(): Promise<void> {
    return new Promise(() => {
      this.subscription.on('message', this.processMessage);
      setTimeout(() => {
        this.subscription.removeAllListeners();  // todo implement this in the mock
        return Promise.all(this.messagesBeingProcessed);
      }, this.listenLimit);
    })
  }

  /**
   * Process an incoming PubSub message
   * @param message incoming PubSub message
   */
  private async processMessage(message: PubsubMessage) {
    throw new Error('Method not implemented.');
  }

  /**
   * Parses the LogEntry object from the given PubSub message
   * @param message PubSub message with log entry
   * @throws error if PubSub message does not contain any data
   */
  private getLogEntryFromMessage(message: PubsubMessage): LogEntry {
    const bufferData = message.data;
    if (!bufferData) {
      throw new Error('PubSub message did not contain any data');
    }
    const jsonData = JSON.parse(bufferData.toString());
    return jsonData as LogEntry;
  }
}
