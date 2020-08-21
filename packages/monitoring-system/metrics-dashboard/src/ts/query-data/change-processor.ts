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

import {
  ProcessedDataCache as PDCache,
  ActionInfo,
  ErrorInfo,
} from './processed-data-cache';
import {
  BotExecutionDocument,
  ActionDocument,
  getPrimaryKey,
  FirestoreCollection,
  GitHubRepositoryDocument,
  ErrorDocument,
} from '../types/firestore-schema';
import {AuthenticatedFirestore} from '../firestore/firestore-client';

/**
 * Type aliases for concise code
 */
type DocumentChange<T> = firebase.firestore.DocumentChange;
type DocumentData = firebase.firestore.DocumentData;
export type Change = DocumentChange<DocumentData>;

/**
 * Type of change in Firestore query
 */
enum ChangeType {
  ADDED = 'added',
  REMOVED = 'removed',
}

export class ChangeProcessor {
  private static firestore = AuthenticatedFirestore.getClient();

  /**
   * Updates Execution counts in Processed Data Cache
   * @param changes Bot_Execution document changes
   */
  public static processExecutionDocChanges(changes: Change[]) {
    const countByBot = PDCache.Executions.countByBot;
    changes.forEach(change => {
      const botExecutionDoc = change.doc.data() as BotExecutionDocument;
      const botName = botExecutionDoc.bot_name;
      if (!countByBot[botName]) {
        countByBot[botName] = 0;
      }
      if (change.type === ChangeType.ADDED) {
        countByBot[botName]++;
      } else if (change.type === ChangeType.REMOVED) {
        countByBot[botName]--;
      }
    });
  }

  /**
   * Updates action info objects in Processed Data Cache
   * @param changes Action document changes
   */
  public static processActionDocChanges(changes: Change[]): Promise<void> {
    const updates = changes.map(change => this.updateActionInfos(change));
    return Promise.allSettled(updates).then(results =>
      this.logRejectedPromises(results)
    );
  }

  /**
   * Updates Action Info objects in Processed Data storage with the given
   * change. If the change adds a document, the new Action Info object
   * is created and cached, else if the change removes a document, then the
   * relevant Action Info object is removed from cache.
   * @param change Action Document change
   */
  private static updateActionInfos(change: Change): Promise<void> {
    const actionInfos = PDCache.Actions.actionInfos;
    const actionDoc = change.doc.data() as ActionDocument;
    const actionDocKey = getPrimaryKey(actionDoc, FirestoreCollection.Action);

    if (change.type === ChangeType.REMOVED && actionInfos[actionDocKey]) {
      delete actionInfos[actionDocKey];
    } else if (change.type === ChangeType.ADDED) {
      return this.buildActionInfo(actionDoc).then(actionInfo => {
        actionInfos[actionDocKey] = actionInfo;
      });
    }
    return Promise.resolve();
  }

  /**
   * Builds an ActionInfo object from the given ActionDocument
   * @param actionDoc an ActionDocument from Firestore
   */
  private static buildActionInfo(
    actionDoc: ActionDocument
  ): Promise<ActionInfo> {
    return this.getCorrespondingRepoDoc(actionDoc).then(repoDoc => {
      return {
        repoName: this.buildFullRepoName(repoDoc),
        time: new Date(actionDoc.timestamp).toLocaleTimeString(),
        url: this.buildActionUrl(actionDoc, repoDoc),
        actionDescription: this.buildActionDescription(actionDoc),
      };
    });
  }

  /**
   * Builds the GitHub Url for the given action and corresponding
   * repository document
   * @param actionDoc action document from Firestore
   * @param repoDoc repository document related to action
   */
  private static buildActionUrl(
    actionDoc: ActionDocument,
    repoDoc: GitHubRepositoryDocument
  ): string {
    const domain = 'https://github.com';
    const gHObjectKey = actionDoc.destination_object;
    const path = gHObjectKey ? this.getObjectPath(gHObjectKey) : '';
    return `${domain}/${repoDoc.repo_name}${path}`;
  }

  /**
   * Build the full GitHub repository name from the given doc
   * @param repoDoc a GitHubRepository doc
   */
  private static buildFullRepoName(repoDoc: GitHubRepositoryDocument): string {
    const privateRepo = repoDoc.private ? ' [private repository]' : '';
    return `${repoDoc.owner_name}/${repoDoc.repo_name}${privateRepo}`;
  }

  /**
   * Build a description for the given action
   * @param actionDoc an ActionDocument
   */
  private static buildActionDescription(actionDoc: ActionDocument): string {
    const value = actionDoc.value === 'NONE' ? '' : `: ${actionDoc.value}`;
    return `${actionDoc.action_type}${value}`;
  }

  /**
   * Get the url path to the object referenced by dstObject
   * @param githubObjectKey primary key of the GitHubObject
   */
  private static getObjectPath(githubObjectKey: string): string {
    // TODO: this is just a quick-fix and should be replaced with an actual
    // call to Firestore
    const parts = githubObjectKey.split('_');
    if (githubObjectKey.includes('PULL_REQUEST')) {
      return `/pulls/${parts[parts.length - 1]}`;
    } else if (githubObjectKey.includes('ISSUE')) {
      return `/issues/${parts[parts.length - 1]}`;
    }
    return '';
  }

  /**
   * Fetch the GitHubRepository document that corresponds to the given ActionDocument
   * @param actionDoc an ActionDocument from Firestore
   */
  private static getCorrespondingRepoDoc(
    actionDoc: ActionDocument
  ): Promise<GitHubRepositoryDocument> {
    const repoPrimaryKey = actionDoc.destination_repo;
    return this.firestore
      .collection(FirestoreCollection.GitHubRepository)
      .doc(repoPrimaryKey)
      .get()
      .then(document => {
        return document.data() as GitHubRepositoryDocument;
      });
  }

  /**
   * Updates Processed Data Cache with the given changes
   * @param changes Error document changes
   * @returns a Promise that resolves after all updates are completed
   */
  public static processErrorDocChanges(changes: Change[]): Promise<void> {
    const updates = changes.map(change => this.updateErrorInfos(change));
    return Promise.allSettled(updates).then(results =>
      this.logRejectedPromises(results)
    );
  }

  private static updateErrorInfos(change: Change) {
    const errorInfos = PDCache.Errors.errorInfos;
    const errorDoc = change.doc.data() as ErrorDocument;
    const primaryKey = getPrimaryKey(errorDoc, FirestoreCollection.Error);

    if (change.type === ChangeType.REMOVED && errorInfos[primaryKey]) {
      delete errorInfos[primaryKey];
    } else if (change.type === ChangeType.ADDED) {
      return this.buildErrorInfo(errorDoc).then(errorInfo => {
        errorInfos[primaryKey] = errorInfo;
      });
    }
    return Promise.resolve();
  }

  /**
   * Builds an ErrorInfo object from the given ErrorDocument
   * @param errorDoc ErrorDocument from Firestore
   */
  private static buildErrorInfo(errorDoc: ErrorDocument): Promise<ErrorInfo> {
    return this.firestore
      .collection(FirestoreCollection.BotExecution)
      .doc(errorDoc.execution_id)
      .get()
      .then(docData => {
        const executionDoc = docData.data() as BotExecutionDocument;
        return {
          msg: this.trimErrorMessage(errorDoc.error_msg),
          time: new Date(errorDoc.timestamp).toLocaleTimeString(),
          logsUrl: executionDoc.logs_url,
          botName: executionDoc.bot_name,
        };
      });
  }

  /**
   * Trims the given error message to 150 chars and adds elipses
   * @param message message to trim
   */
  private static trimErrorMessage(message: string): string {
    return message.substring(0, 150) + '...';
  }

  /**
   * Logs errors from rejected promises
   * @param results results from a list of promises
   */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  private static logRejectedPromises(results: PromiseSettledResult<any>[]) {
    results
      .filter(result => result.status === 'rejected')
      .forEach((result: PromiseRejectedResult) => {
        console.error(
          `Failed to build some Action Info objects: ${result.reason}`
        );
      });
  }
}
