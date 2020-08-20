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
} from './processed-data-cache';
import {
  BotExecutionDocument,
  ActionDocument,
  getPrimaryKey,
  FirestoreCollection,
  GitHubRepositoryDocument,
} from './firestore-schema';
import {AuthenticatedFirestore} from './firestore-client';

/**
 * Type aliases for concise code
 */
type DocumentChange<T> = firebase.firestore.DocumentChange;
type DocumentData = firebase.firestore.DocumentData;
export type Changes = Array<DocumentChange<DocumentData>>;

export class ChangeProcessor {
  private static firestore = AuthenticatedFirestore.getClient();

  /**
   * Updates Execution counts in Processed Data Cache
   * @param changes Bot_Execution document changes
   */
  public static updateExecutionCountsByBot(changes: Changes) {
    const countByBot = PDCache.Executions.countByBot;
    changes.forEach(change => {
      const botExecutionDoc = change.doc.data() as BotExecutionDocument;
      const botName = botExecutionDoc.bot_name;
      if (!countByBot[botName]) {
        countByBot[botName] = 0;
      }
      if (change.type === 'added') {
        countByBot[botName]++;
      } else if (change.type === 'removed') {
        countByBot[botName]--;
      }
    });
  }

  /**
   * Updates action info objects in Processed Data Cache
   * @param changes Action document changes
   */
  public static updateActionInfos(changes: Changes) {
    const actionInfos = PDCache.Actions.actionInfos;
    const updates = changes.map(change => {
      const actionDoc = change.doc.data() as ActionDocument;
      const actionDocKey = getPrimaryKey(actionDoc, FirestoreCollection.Action);

      if (change.type === 'removed' && actionInfos[actionDocKey]) {
        delete actionInfos[actionDocKey];
      } else if (change.type === 'added') {
        return this.buildActionInfo(actionDoc).then(actionInfo => {
          actionInfos[actionDocKey] = actionInfo;
        });
      }

      return Promise.resolve();
    });
    return Promise.all(updates); // TODO will short-circuit
  }

  /**
   * Builds an ActionInfo object from the given ActionDocument
   * @param actionDoc an ActionDocument from Firestore
   */
  private static buildActionInfo(
    actionDoc: ActionDocument
  ): Promise<ActionInfo> {
    const githubObjectKey = actionDoc.destination_object;
    return this.getCorrespondingRepoDoc(actionDoc).then(repoDoc => {
      let url = `https://github.com/${name}`;
      // TODO: replace with actual call to firestore
      if (githubObjectKey) {
        url += this.getObjectPath(githubObjectKey);
      }
      return {
        repoName: this.getFullRepoName(repoDoc),
        time: new Date(actionDoc.timestamp).toLocaleTimeString(),
        url: url,
        actionDescription: this.getActionDescription(actionDoc),
      };
    });
  }

  /**
   * Build the full GitHub repository name from the given doc
   * @param repoDoc a GitHubRepository doc
   */
  private static getFullRepoName(repoDoc: GitHubRepositoryDocument): string {
    let name = `${repoDoc.owner_name}/${repoDoc.repo_name}`;
    if (repoDoc.private) {
      name += ' [private repository]';
    }
    return name;
  }

  /**
   * Build a description for the given action
   * @param actionDoc an ActionDocument
   */
  private static getActionDescription(actionDoc: ActionDocument): string {
    return `${actionDoc.action_type}${
      actionDoc.value === 'NONE' ? '' : ': ' + actionDoc.value
    }`;
  }

  /**
   * Build the url path to the object referenced by dstObject
   * TODO: this is just a quick-fix and should be replaced with an actual
   * call to Firestore
   * @param githubObjectKey primary key of the GitHubObject
   */
  private static getObjectPath(githubObjectKey: string): string {
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
   * Updates currentFilterErrors.formattedErrors with the given changes
   * @param changes Error document changes
   * @returns a Promise that resolves after all updates are completed
   */
  public static updateFormattedErrors(changes: any[]) {
    const formattedErrors: any = PDCache.currentFilterErrors.formattedErrors;
    const updates = changes.map(change => {
      const doc = change.doc.data();
      const primaryKey = `${doc.execution_id}_${doc.timestamp}`;
      if (change.type === 'removed' && formattedErrors[primaryKey]) {
        delete formattedErrors[primaryKey];
        return Promise.resolve();
      } else if (change.type === 'added') {
        return this.buildFormattedError(doc).then((formattedDoc: any) => {
          formattedErrors[primaryKey] = formattedDoc;
        });
      }
    });
    return Promise.all(updates); // TODO will short-circuit
  }

  /**
   * Builds a formatted error document from an error document
   * @param errorDoc error document from Firestore
   * @returns a Promise that resolves the formatted document
   */
  private static buildFormattedError(errorDoc: any) {
    const executionId = errorDoc.execution_id;
    return this.firestore
      .collection('Bot_Execution') // TODO could check local cache
      .doc(executionId)
      .get()
      .then((executionDoc: any) => {
        const msg = errorDoc.error_msg;
        const time = errorDoc.timestamp;
        const botName = executionDoc.data().bot_name;
        return {
          msg: String(msg).substring(0, 200) + '...', // TODO: replace with div overflow prop
          time: new Date(time).toLocaleTimeString(),
          logsUrl: executionDoc.data().logs_url,
          botName: botName,
        };
      });
  }
}
