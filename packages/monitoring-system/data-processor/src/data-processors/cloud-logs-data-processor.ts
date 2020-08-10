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
import {
  BotExecutionDocument,
  getPrimaryKey,
  FirestoreCollection as FSCollection,
  TriggerDocument,
  GitHubRepositoryDocument,
  OwnerType,
  FirestoreDocument,
  ActionDocument,
  GitHubObjectDocument,
  ErrorDocument,
  FirestoreRecord,
} from '../types/firestore-schema';
import {
  instanceOfLogEntry,
  parseLogEntryType,
  LogEntryType,
  LogEntry,
  TriggerInfoLogEntry,
  GitHubActionLogEntry,
  TriggerType,
} from '../types/cloud-logs';
import {hasUndefinedValues} from '../types/type-check-util';

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
    this.subscription.on('message', this.processMessage.bind(this));
    this.logger.debug('Now listening for PubSub messages');

    return new Promise((resolve, reject) => {
      const stopListening = () => {
        this.subscription.removeAllListeners();
        this.logger.debug(`Stopped listening after ${this.listenLimit}s`);

        Promise.all(this.tasksInProgress)
          .then(() => {
            this.logger.debug('All messages processed');
            resolve();
          })
          .catch(error => {
            this.logger.error('Some messages could not be processed');
            reject(error);
          });
      };

      setTimeout(stopListening, this.listenLimit * 1000);
    });
  }

  /**
   * Parses the LogEntry from the message, determines its type, and routes
   * valid log entries to the correct handler. Handling tasks are added to the
   * tasksInProgress queue for asynchronous completion.
   *
   * Malformed messages are logged and acknowledged immediately.
   *
   * @param pubSubMessage an incoming PubSub message
   */
  private async processMessage(pubSubMessage: Message) {
    this.logger.debug(`Processing message ${pubSubMessage.id}`);
    const logEntry: object = this.parsePubSubData(pubSubMessage);

    if (!instanceOfLogEntry(logEntry)) {
      this.logError('Detected malformed log entry', pubSubMessage);
      return pubSubMessage.ack();
    }

    const logEntryType = parseLogEntryType(logEntry);

    if (logEntryType === LogEntryType.NON_METRIC) {
      return pubSubMessage.ack();
    }
    if (logEntryType === LogEntryType.MALFORMED) {
      this.logError('Detected malformed log entry', pubSubMessage);
      return pubSubMessage.ack();
    }

    const processingTask = this.processLogEntry(logEntry, logEntryType)
      .then(result => this.ackIfSuccess(result, pubSubMessage))
      .catch(error => {
        this.logError(
          'Runtime error while processing message',
          pubSubMessage,
          error
        );
        pubSubMessage.nack();
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

  private logError(errorMsg: string, pubSubMessage: Message, error?: Error) {
    this.logger.error({
      message: errorMsg,
      messageId: pubSubMessage.id,
      error: error,
      pubSubMessageData: this.parsePubSubData(pubSubMessage),
    });
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
      this.logError('PubSub message contains no data', pubSubMessage);
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
        return this.processTriggerInfoLog(entry as TriggerInfoLogEntry);
      case LogEntryType.GITHUB_ACTION:
        return this.processGitHubActionLog(entry as GitHubActionLogEntry);
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
    const botExecDoc: BotExecutionDocument = {
      execution_id: entry.labels.execution_id,
      bot_name: entry.resource.labels.function_name,
      start_time: new Date(entry.timestamp).getTime(),
      logs_url: this.buildExecutionLogsUrl(entry),
    };
    return this.updateFirestoreRecords([
      {doc: botExecDoc, collection: FSCollection.BotExecution},
    ]);
  }

  private buildExecutionLogsUrl(entry: LogEntry): string {
    const TIME_RANGE_MILLISECONDS = 5 * 1000;
    const domain = 'pantheon.corp.google.com'; // should be console.google.com but the redirect wipes the query
    const executionId = entry.labels.execution_id;
    const project = entry.resource.labels.project_id;
    const start = new Date(
      new Date(entry.timestamp).getTime() - TIME_RANGE_MILLISECONDS
    );
    const end = new Date(
      new Date(entry.timestamp).getTime() + TIME_RANGE_MILLISECONDS
    );

    return (
      `https://${domain}/logs/query;query=` +
      `labels.execution_id%3D%22${executionId}%22;` +
      `timeRange=${start.toISOString()}%2F${end.toISOString()}` +
      `?project=${project}&query=%0A`
    );
  }

  /**
   * Processes a log entry marking the end of the execution
   * @param entry execution end log entry
   */
  private async processExecutionEndLog(entry: LogEntry): ProcessingTask {
    const botExecDoc: BotExecutionDocument = {
      execution_id: entry.labels.execution_id,
      bot_name: entry.resource.labels.function_name,
      end_time: new Date(entry.timestamp).getTime(),
    };
    return this.updateFirestoreRecords([
      {doc: botExecDoc, collection: FSCollection.BotExecution},
    ]);
  }

  /**
   * Processes a log entry with trigger information for the execution
   * @param entry log entry with trigger information
   */
  private async processTriggerInfoLog(
    entry: TriggerInfoLogEntry
  ): ProcessingTask {
    const updates: FirestoreRecord[] = [];

    const botExecDoc: BotExecutionDocument = {
      execution_id: entry.labels.execution_id,
      bot_name: entry.resource.labels.function_name,
    };
    updates.push({doc: botExecDoc, collection: FSCollection.BotExecution});

    const payload = entry.jsonPayload;
    const triggerDoc: TriggerDocument = {
      execution_id: entry.labels.execution_id,
      trigger_type: payload.trigger.trigger_type,
    };
    if (payload.trigger.payload_hash) {
      triggerDoc.github_event = payload.trigger.payload_hash;
    }
    updates.push({doc: triggerDoc, collection: FSCollection.Trigger});

    const sourceRepo = payload.trigger.trigger_source_repo;
    if (sourceRepo) {
      const repoDoc: GitHubRepositoryDocument = {
        repo_name: sourceRepo.repo_name,
        owner_name: sourceRepo.owner,
        owner_type: sourceRepo.owner_type as OwnerType,
      };
      updates.push({doc: repoDoc, collection: FSCollection.GitHubRepository});
    }

    return this.updateFirestoreRecords(updates);
  }

  /**
   * Processes a log entry with information on a GitHub action
   * @param entry log entry with GitHub action info
   */
  private async processGitHubActionLog(
    entry: GitHubActionLogEntry
  ): ProcessingTask {
    const updates: FirestoreRecord[] = [];
    const payload = entry.jsonPayload;

    const botExecDoc: BotExecutionDocument = {
      execution_id: entry.labels.execution_id,
      bot_name: entry.resource.labels.function_name,
    };
    updates.push({doc: botExecDoc, collection: FSCollection.BotExecution});

    const repoDoc: GitHubRepositoryDocument = {
      repo_name: payload.action.destination_repo.repo_name,
      owner_name: payload.action.destination_repo.owner,
    };
    updates.push({doc: repoDoc, collection: FSCollection.GitHubRepository});

    let objectDoc: GitHubObjectDocument | undefined = undefined;
    if (payload.action.destination_object) {
      objectDoc = {
        object_type: payload.action.destination_object.object_type,
        object_id: payload.action.destination_object.object_id,
        repository: getPrimaryKey(repoDoc, FSCollection.GitHubRepository),
      };
      updates.push({doc: objectDoc, collection: FSCollection.GitHubObject});
    }

    const actionDoc: ActionDocument = {
      execution_id: entry.labels.execution_id,
      action_type: payload.action.type,
      value: payload.action.value,
      timestamp: new Date(entry.timestamp).getTime(),
      destination_repo: getPrimaryKey(repoDoc, FSCollection.GitHubRepository),
    };
    if (objectDoc) {
      actionDoc.destination_object = getPrimaryKey(
        objectDoc,
        FSCollection.GitHubObject
      );
    }
    updates.push({doc: actionDoc, collection: FSCollection.Action});

    return this.updateFirestoreRecords(updates);
  }

  /**
   * Processes a log entry with an execution error
   * @param entry log entry with error
   */
  private async processErrorLog(entry: LogEntry): ProcessingTask {
    const updates: FirestoreRecord[] = [];

    const botExecDoc: BotExecutionDocument = {
      execution_id: entry.labels.execution_id,
      bot_name: entry.resource.labels.function_name,
    };
    updates.push({doc: botExecDoc, collection: FSCollection.BotExecution});

    const errorDoc: ErrorDocument = {
      execution_id: entry.labels.execution_id,
      timestamp: new Date(entry.timestamp).getTime(),
      error_msg: entry.textPayload || JSON.stringify(entry.jsonPayload),
    };
    updates.push({doc: errorDoc, collection: FSCollection.Error});

    return this.updateFirestoreRecords(updates);
  }

  /**
   * Updates all the given records in Firestore.
   * - Resolves with SUCCESS if all records were successfully updates
   * - else resolves with FAIL
   * @param records documents to update with their collection name
   */
  private async updateFirestoreRecords(
    records: FirestoreRecord[]
  ): ProcessingTask {
    const updates: ProcessingTask[] = records.map(record => {
      return this.updateFirestore(record).then(() => {
        return ProcessingResult.SUCCESS;
      });
    });

    return Promise.all(updates).then(results => {
      const allSuccess = results.every(
        result => result === ProcessingResult.SUCCESS
      );
      return allSuccess ? ProcessingResult.SUCCESS : ProcessingResult.FAIL;
    });
  }
}
