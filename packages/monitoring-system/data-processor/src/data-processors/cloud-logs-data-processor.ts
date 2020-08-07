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
} from '../types/firestore-schema';
import {
  instanceOfLogEntry,
  parseLogEntryType,
  LogEntryType,
  LogEntry,
  TriggerInfoLogEntry,
  GitHubActionLogEntry,
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
   * valid log entries to the correct handler. Handling tasks added to the
   * inProcess queue for asynchronous completion.
   *
   * Malformed messages are logged and acknowledged immediately.
   *
   * @param pubSubMessage an incoming PubSub message
   */
  private async processMessage(pubSubMessage: Message) {
    this.logger.debug(`Processing message ${pubSubMessage.id}`);
    const logEntry: object = this.parsePubSubData(pubSubMessage);

    if (!instanceOfLogEntry(logEntry)) {
      this.logger.error({
        message: 'Detected malformed log entry',
        messageId: pubSubMessage.id,
        pubSubMessage: pubSubMessage,
        parsedJSON: logEntry,
      });
      pubSubMessage.ack();
      return;
    }

    const logEntryType = parseLogEntryType(logEntry);
    this.logger.debug(`Message ${pubSubMessage.id} is a ${logEntryType}`);

    if (logEntryType === LogEntryType.NON_METRIC) {
      this.logger.debug({
        message: 'Ignoring log entry with no metrics',
        entry: logEntry,
      });
      pubSubMessage.ack();
      return;
    }
    if (logEntryType === LogEntryType.MALFORMED) {
      this.logger.error({
        message: 'Detected malformed log entry',
        entry: logEntry,
      });
      pubSubMessage.ack();
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
        pubSubMessage.nack();
        this.logger.debug(`${pubSubMessage.id} was nacked`);
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
      this.logger.debug(`${pubSubMessage.id} was acked`);
    } else {
      pubSubMessage.nack();
      this.logger.debug(`${pubSubMessage.id} was nacked`);
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

    return this.updateFirestore(botExecDoc, FSCollection.BotExecution);
  }

  private buildExecutionLogsUrl(entry: LogEntry): string {
    const TIME_RANGE_MILLISECONDS = 5 * 1000;
    const domain = 'pantheon.corp.google.com'; // should be console.google.com but the redirect wipes the query
    const executionId = entry.labels.execution_id;
    const project = entry.resource.labels.project_id;
    const start = new Date(entry.timestamp).getTime() - TIME_RANGE_MILLISECONDS;
    const end = new Date(entry.timestamp).getTime() + TIME_RANGE_MILLISECONDS;

    return (
      `https://${domain}/logs/query;query=` +
      `labels.execution_id%3D%22${executionId}%22;` +
      `timeRange=${new Date(start).toISOString()}%2F${new Date(
        end
      ).toISOString()}` +
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

    return this.updateFirestore(botExecDoc, FSCollection.BotExecution);
  }

  /**
   * Processes a log entry with trigger information for the execution
   * @param entry log entry with trigger information
   */
  private async processTriggerInfoLog(
    entry: TriggerInfoLogEntry
  ): ProcessingTask {
    const updates: ProcessingTask[] = [];

    const botExecDoc: BotExecutionDocument = {
      execution_id: entry.labels.execution_id,
      bot_name: entry.resource.labels.function_name,
    };
    updates.push(this.updateFirestore(botExecDoc, FSCollection.BotExecution));

    const payload = entry.jsonPayload;
    const triggerDoc: TriggerDocument = {
      execution_id: entry.labels.execution_id,
      github_event: payload.trigger.payload_hash,
      trigger_type: payload.trigger.trigger_type,
    };
    this.logger.debug(triggerDoc);
    updates.push(this.updateFirestore(triggerDoc, FSCollection.Trigger));

    const sourceRepo = payload.trigger.trigger_source_repo;
    if (sourceRepo) {
      const repoDoc: GitHubRepositoryDocument = {
        repo_name: sourceRepo.repo_name,
        owner_name: sourceRepo.owner,
        owner_type: sourceRepo.owner_type as OwnerType,
      };
      updates.push(
        this.updateFirestore(repoDoc, FSCollection.GitHubRepository)
      );
    }

    return Promise.all(updates).then(results => {
      const allSuccess = results.every(
        result => result === ProcessingResult.SUCCESS
      );
      return allSuccess ? ProcessingResult.SUCCESS : ProcessingResult.FAIL;
    });
  }

  /**
   * Processes a log entry with information on a GitHub action
   * @param entry log entry with GitHub action info
   */
  private async processGitHubActionLog(
    entry: GitHubActionLogEntry
  ): ProcessingTask {
    const updates: ProcessingTask[] = [];
    const payload = entry.jsonPayload;

    const botExecDoc: BotExecutionDocument = {
      execution_id: entry.labels.execution_id,
      bot_name: entry.resource.labels.function_name,
    };
    updates.push(this.updateFirestore(botExecDoc, FSCollection.BotExecution));

    const repoDoc: GitHubRepositoryDocument = {
      repo_name: payload.action.destination_repo.repo_name,
      owner_name: payload.action.destination_repo.owner,
    };
    updates.push(this.updateFirestore(repoDoc, FSCollection.GitHubRepository));

    let objectDoc: GitHubObjectDocument | undefined = undefined;
    if (payload.action.destination_object) {
      objectDoc = {
        object_type: payload.action.destination_object.object_type,
        object_id: payload.action.destination_object.object_id,
        repository: getPrimaryKey(repoDoc, FSCollection.GitHubRepository),
      };
      updates.push(this.updateFirestore(objectDoc, FSCollection.GitHubObject));
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
    updates.push(this.updateFirestore(actionDoc, FSCollection.Action));

    return Promise.all(updates).then(results => {
      const allSuccess = results.every(
        result => result === ProcessingResult.SUCCESS
      );
      return allSuccess ? ProcessingResult.SUCCESS : ProcessingResult.FAIL;
    });
  }

  /**
   * Processes a log entry with an execution error
   * @param entry log entry with error
   */
  private async processErrorLog(entry: LogEntry): ProcessingTask {
    const updates: ProcessingTask[] = [];
    const payload = entry.jsonPayload;

    const botExecDoc: BotExecutionDocument = {
      execution_id: entry.labels.execution_id,
      bot_name: entry.resource.labels.function_name,
    };
    updates.push(this.updateFirestore(botExecDoc, FSCollection.BotExecution));

    const errorDoc: ErrorDocument = {
      execution_id: entry.labels.execution_id,
      timestamp: new Date(entry.timestamp).getTime(),
      error_msg: entry.textPayload,
    };
    updates.push(this.updateFirestore(errorDoc, FSCollection.Error));

    return Promise.all(updates).then(results => {
      const allSuccess = results.every(
        result => result === ProcessingResult.SUCCESS
      );
      return allSuccess ? ProcessingResult.SUCCESS : ProcessingResult.FAIL;
    });
  }

  /**
   * Inserts the given document into the specified collection in Firestore, following these rules:
   * - if a document with the same key already exists, updates the fields with those in `doc`
   * - if no document with the same key exists, creates a new document with fields from `doc`
   * @param doc Firestore document to insert
   * @param collection collection in which document belongs
   * @param docKey (optional) the primary key for the given document
   * @throws if doc is invalid or doesn't match given collection
   */
  private async updateFirestore(
    doc: FirestoreDocument,
    collection: FSCollection
  ): ProcessingTask {
    return new Promise<ProcessingResult>(resolve => {
      const docKey = getPrimaryKey(doc, collection);

      this.firestore
        .collection(collection)
        .doc(docKey)
        .set(doc, {merge: true})
        .then(() => resolve(ProcessingResult.SUCCESS))
        .catch(error => {
          this.logger.error({
            message: `Failed to insert document into Firestore: ${error}`,
            document: doc,
            collection: collection,
          });
          return resolve(ProcessingResult.FAIL);
        });
    });
  }
}
