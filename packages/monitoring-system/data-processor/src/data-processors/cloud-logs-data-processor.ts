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
import {BotExecutionDocument} from '../types/firestore-schema';
import {WriteResult} from '@google-cloud/firestore';
import {
  instanceOfLogEntry,
  parseLogEntryType,
  LogEntryType,
  LogEntry,
} from '../types/cloud-logs';

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
 * Represents the processing task for an incoming PubSub message.
 *
 * Resolve with SUCCESS = the message was successfully processed
 * Resolve with FAIL = processing failed due to bad message
 * Rejected = processing failed due to runtime error (eg. pubsub issue)
 */
type ProcessingTask = Promise<ProcessingResult>;

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
      this.subscription.on('message', this.processMessage.bind(this));
      this.logger.debug('Now listening for PubSub messages');

      setTimeout(() => {
        this.subscription.removeAllListeners();
        this.logger.debug(
          `Stopped listening to PubSub after ${this.listenLimit}s`
        );
        return Promise.all(this.tasksInProgress);
      }, this.listenLimit * 1000);
    });
  }

  /**
   * Parses the LogEntry from the message, determines its type, and routes
   * valid log entries to the correct handler. Handling tasks added to the
   * inProcess queue for asynchronous completion.
   *
   * Malformed messages are logged and acknowledged immediately.
   *
   * @param pubSubMessage an incoming PubSub message
   */
  private async processMessage(pubSubMessage: Message) {
    const logEntry: object = this.parsePubSubData(pubSubMessage);

    if (!instanceOfLogEntry(logEntry)) {
      this.logger.error({
        message: 'JSON from PubSub message is not a valid log entry',
        messageId: pubSubMessage.id,
        pubSubMessage: pubSubMessage,
        parsedJSON: logEntry,
      });
      return;
    }

    const logEntryType = parseLogEntryType(logEntry);
    if (logEntryType === LogEntryType.NON_METRIC) {
      this.logger.debug({
        message: 'Ignoring log entry with no metrics',
        entry: logEntry,
      });
      return;
    }
    if (logEntryType === LogEntryType.MALFORMED) {
      this.logger.error({
        message: 'Detected malformed log entry',
        entry: logEntry,
      });
      return;
    }

    const processingTask = this.processLogEntry(logEntry, logEntryType)
      .then(result => this.ackIfSuccess(result, pubSubMessage))
      .catch(error => {
        this.logger.error({
          message: 'Runtime error while processing message',
          messageId: pubSubMessage.id,
          error: error,
          pubSubMessage: pubSubMessage,
        });
        throw error;
      });

    this.tasksInProgress.push(processingTask);
  }

  /**
   * Calls ack() on the message if the result is SUCCESS, else calls nack()
   * @param result processing result
   * @param pubSubMessage PubSub message
   * @returns the result given
   */
  private ackIfSuccess(
    result: ProcessingResult,
    pubSubMessage: Message
  ): ProcessingResult {
    if (result === ProcessingResult.SUCCESS) {
      pubSubMessage.ack();
    } else {
      pubSubMessage.nack();
    }
    return result;
  }

  /**
   * Parses the JSON object from the given PubSub message
   *
   * @param pubSubMessage PubSub message with JSON data
   * @returns parsed JSON from the PubSub message or an
   * empty object if there's no data in the message
   */
  private parsePubSubData(pubSubMessage: Message): object {
    const bufferData = pubSubMessage.data;
    if (!bufferData) {
      this.logger.error({
        message: 'PubSub message contains no data',
        entry: pubSubMessage,
      });
      return {};
    } else {
      return JSON.parse(bufferData.toString());
    }
  }

  /**
   * Routes the given log entry to the correct handler based on
   * the type of of the log entry.
   *
   * @param entry entry to route
   * @param type type of the log entry
   * @returns A promise for the processing task with a processing result.
   * If no handler is set for the given log entry type, returns a rejected promise.
   */
  private processLogEntry(entry: LogEntry, type: LogEntryType): ProcessingTask {
    switch (type) {
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
      default:
        this.logger.error({
          message: 'No handler set for the given log entry type',
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
