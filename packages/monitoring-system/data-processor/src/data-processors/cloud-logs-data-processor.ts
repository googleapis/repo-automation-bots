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
import {Subscription, Message} from '@google-cloud/pubsub';
import {BotExecutionDocument} from '../firestore-schema';
import {WriteResult} from '@google-cloud/firestore';

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
 * The result of processing and storing a log entry
 */
enum ProcessingResult {
  SUCCESS = 'Log entry was successfully processed',
  FAIL = 'Log entry could not be processes',
}

/**
 * Represents the processing task for an incoming PubSub
 * entry. Resolves with either a SUCCESS or FAIL result
 * depending on the outcome of the processing. Rejects
 * only for runtime errors.
 */
type ProcessingTask = Promise<ProcessingResult>;

/**
 * Categories of incoming log messages
 */
enum LogEntryType {
  EXECUTION_START,
  EXECUTION_END,
  TRIGGER_INFO,
  GITHUB_ACTION,
  ERROR,
  NON_METRIC,
  MALFORMED,
}

/**
 * Cloud Logging / Stackdriver log entry structure
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
  private tasksInProgress: ProcessingTask[] = [];
  private subscription: Subscription;
  private listenLimit: number;

  /**
   * Create a Cloud Logs processor instance
   *
   * @param options cloud logs processor options
   */
  constructor(options: CloudLogsProcessorOptions) {
    super(options);
    this.subscription = options.subscription;
    this.listenLimit = options.listenLimit;
  }

  /**
   * Start the collection and processing task
   *
   * @returns a promise that settles once all received messages
   * have been processed (successfully or unsuccessfully). The promise
   * will be fulfilled even if some messages are unsuccessfully processed.
   * The promise will only reject for runtime errors such as loss of
   * communication to PubSub.
   */
  public async collectAndProcess(): Promise<void> {
    return new Promise(() => {
      this.subscription.on('message', this.processMessage);
      setTimeout(() => {
        this.subscription.removeAllListeners(); // TODO implement this in the mock
        return Promise.all(this.tasksInProgress);
      }, this.listenLimit);
    });
  }

  /**
   * Parses the LogEntry from the message, determines its type, and routes
   * valid log entries to the correct handler. Handling tasks added to the
   * inProcess queue for asynchronous completion.
   *
   * Malformed messages are logged and acknowledged immediately.
   *
   * @param message an incoming PubSub message
   */
  private async processMessage(message: Message) {
    const logEntry = this.getLogEntryFromMessage(message);
    const logEntryType = this.parseLogEntryType(logEntry);

    const messageProcessingTask = this.routeLogEntryToHandler(
      logEntry,
      logEntryType
    );

    messageProcessingTask
      .then(result => {
        if (result === ProcessingResult.SUCCESS) {
          message.ack();
        } else {
          message.nack();
        }
      })
      .catch(error => {
        this.logger.error({
          message: 'Runtime error while processing message',
          messageId: message.id,
          error: error,
        });
      });

    this.tasksInProgress.push(messageProcessingTask);
  }

  /**
   * Parses the LogEntry object from the given PubSub message
   *
   * @param pubSubMessage PubSub message with log entry
   * @returns parsed log entry from the PubSub message or an
   * empty object if there's no data in the message
   */
  private getLogEntryFromMessage(pubSubMessage: Message): LogEntry {
    const bufferData = pubSubMessage.data;
    if (!bufferData) {
      this.logger.error({
        message: 'PubSub message contains no data',
        entry: pubSubMessage,
      });
      return {} as LogEntry;
    } else {
      return JSON.parse(bufferData.toString()) as LogEntry;
    }
  }

  /**
   * Determines the LogEntryType for the given LogEntry
   *
   * @param entry LogEntry to parse
   */
  private parseLogEntryType(entry: LogEntry): LogEntryType {
    // TODO: log error for malformed entries
    throw new Error('Method not implemented.');
  }

  /**
   * Routes the given log entry to the correct handler based on
   * the type of of the log entry.
   *
   * @param entry entry to route
   * @param type type of the log entry
   * @returns A promise for the processing task with a processing result.
   * - If the log entry type is NON_METRIC, returns a Promise that immediately
   *   resolves with a SUCCESS status.
   * - If the log entry type is MALFORMED or there is no handler available for
   *   log entry type returns a Promise that resolves immediately with a FAIL status.
   * - Promises only reject for runtime errors.
   */
  private routeLogEntryToHandler(
    entry: LogEntry,
    type: LogEntryType
  ): ProcessingTask {
    switch (type) {
      case LogEntryType.NON_METRIC:
        this.logger.debug({
          message: 'Ignoring log entry with no metrics',
          entry: entry,
        });
        return Promise.resolve(ProcessingResult.SUCCESS);
      case LogEntryType.EXECUTION_START:
        return this.processExecutionStartLog(entry);
      case LogEntryType.EXECUTION_END:
        return this.processExecutionEndLog(entry);
      case LogEntryType.TRIGGER_INFO:
        return this.processTriggerInfoLog(entry);
      case LogEntryType.GITHUB_ACTION:
        return this.processGitHubActionLog(entry);
      case LogEntryType.ERROR:
        return this.processErrorLog(entry);
      case LogEntryType.MALFORMED:
      default:
        this.logger.error({
          message: 'Could not identify a handler for the log entry',
          entry: entry,
        });
        return Promise.resolve(ProcessingResult.FAIL);
    }
  }

  /**
   * Processes a log entry marking the start of the execution
   * @param entry execution start log entry
   */
  private async processExecutionStartLog(entry: LogEntry): ProcessingTask {
    throw new Error('Method not implemented.');
  }

  /**
   * Processes a log entry marking the end of the execution
   * @param entry execution end log entry
   */
  private async processExecutionEndLog(entry: LogEntry): ProcessingTask {
    throw new Error('Method not implemented.');
  }

  /**
   * Processes a log entry with trigger information for the execution
   * @param entry log entry with trigger information
   */
  private async processTriggerInfoLog(entry: LogEntry): ProcessingTask {
    throw new Error('Method not implemented.');
  }

  /**
   * Processes a log entry with information on a GitHub action
   * @param entry log entry with GitHub action info
   */
  private async processGitHubActionLog(entry: LogEntry): ProcessingTask {
    throw new Error('Method not implemented.');
  }

  /**
   * Processes a log entry with an execution error
   * @param entry log entry with error
   */
  private async processErrorLog(entry: LogEntry): ProcessingTask {
    throw new Error('Method not implemented.');
  }

  /**
   * Inserts the given bot execution information into Firestore:
   * - if a document with the same key already exists, updates the fields with those in `doc`
   * - if no document with the same key exists, creates a new document with fields from `doc`
   * @param doc BotExecutionDocument containing new information to insert into Firestore
   */
  private async storeBotExecutionDoc(
    doc: BotExecutionDocument
  ): Promise<WriteResult> {
    throw new Error('Method not implemented.');
  }
}
