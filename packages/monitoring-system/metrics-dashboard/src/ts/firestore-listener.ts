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

import {Render} from './render';
import {
  ProcessedDataCache as PDCache,
  ActionInfo,
} from './processed-data-cache';
import * as firebase from 'firebase/app';

/** Required for Firestore capabilities */
import 'firebase/firestore';
import {
  FirestoreCollection,
  BotExecutionDocument,
  ActionDocument,
  GitHubRepositoryDocument,
  TaskQueueStatusDocument,
  getPrimaryKey,
} from './firestore-schema';

/**
 * Type aliases for concise code
 */
type Firestore = firebase.firestore.Firestore;
type DocumentChange<T> = firebase.firestore.DocumentChange;
type DocumentData = firebase.firestore.DocumentData;

/**
 * A function returned by a listener that can be called
 * to remove that listener
 */
type Unsubscriber = () => void;

/**
 * Filters on metrics set by the user
 */
interface UserFilters {
  timeRange?: {
    /* UNIX timestamp */
    start?: number;
    /* UNIX timestamp */
    end?: number;
  };
}

/**
 * Listens to data from Firestore and renders results
 */
class FirestoreListener {
  /* Authenticated Firestore client */
  private firestore: Firestore;

  /* The current user filters */
  private filters: UserFilters;

  /* Callback functions to remove current listeners */
  private unsubscribers: Unsubscriber[] = [];

  /**
   * Sets listeners on Firestore based on the current user filters
   * and renders the results
   */
  public resetListeners() {
    this.initFirestoreClient();

    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];

    this.filters = this.getCurrentUserFilters();

    this.unsubscribers.push(
      this.listenToBotExecutions(),
      this.listenToErrors(),
      this.listenToTaskQueueStatus(),
      this.listenToActions()
    );
  }

  /**
   * Returns the current data filters set by the user
   *
   * TODO: Implement
   * Currently this just returns fixed values
   */
  private getCurrentUserFilters(): UserFilters {
    return {
      timeRange: {
        start: new Date().getTime() - 60 * 60 * 1000,
      },
    };
  }

  /**
   * Listens to Bot Execution docs from Firestore that match user filters
   */
  private listenToBotExecutions(): Unsubscriber {
    return this.firestore
      .collection(FirestoreCollection.BotExecution)
      .where('start_time', '>', this.filters.timeRange.start)
      .onSnapshot(querySnapshot => {
        this.updateExecutionCountsByBot(querySnapshot.docChanges());
        Render.executionsByBot(PDCache.Executions.countByBot);
      });
  }

  /**
   * Updates Execution counts in Processed Data Cache
   * @param changes Bot_Execution document changes
   */
  private updateExecutionCountsByBot(
    changes: Array<DocumentChange<DocumentData>>
  ) {
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
   * Listens to Action docs from Firestore that match user filters
   */
  private listenToActions(): Unsubscriber {
    return this.firestore
      .collection(FirestoreCollection.Action)
      .where('timestamp', '>', this.filters.timeRange.start)
      .onSnapshot(querySnapshot => {
        this.updateActionInfos(querySnapshot.docChanges()).then(() => {
          Render.actions(Object.values(PDCache.Actions.actionInfos));
        });
      });
  }

  /**
   * Updates action info objects in Processed Data Cache
   * @param changes Action document changes
   */
  private updateActionInfos(changes: Array<DocumentChange<DocumentData>>) {
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
  private buildActionInfo(actionDoc: ActionDocument): Promise<ActionInfo> {
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
   * Build the url path to the object referenced by dstObject
   * TODO: this is just a quick-fix and should be replaced with an actual
   * call to Firestore
   * @param githubObjectKey primary key of the GitHubObject
   */
  private getObjectPath(githubObjectKey: string): string {
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
  private getCorrespondingRepoDoc(
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
   * Build the full GitHub repository name from the given doc
   * @param repoDoc a GitHubRepository doc
   */
  private getFullRepoName(repoDoc: GitHubRepositoryDocument): string {
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
  private getActionDescription(actionDoc: ActionDocument): string {
    return `${actionDoc.action_type}${
      actionDoc.value === 'NONE' ? '' : ': ' + actionDoc.value
    }`;
  }

  /**
   * Sets a listener for the Task Queue status that match the current user filters
   */
  private listenToTaskQueueStatus(): Unsubscriber {
    // TODO: currently this just grabs the first 20 records
    // change it so that it finds the latest timestamp and gets
    // all records with that timestamp
    return this.firestore
      .collection('Task_Queue_Status')
      .orderBy('timestamp', 'desc')
      .limit(20)
      .onSnapshot(querySnapshot => {
        const byBot: any = {};
        const docs = querySnapshot.docs.map((doc: any) => doc.data());
        docs.forEach((doc: any) => {
          const botName = doc.queue_name.replace(/-/g, '_');
          if (!byBot[botName]) {
            byBot[botName] = doc.in_queue;
          }
        });
        Render.tasksByBot(byBot);
      });
  }

  /**
   * Sets a listener for execution errors that match the current user filters
   */
  private listenToErrors(): Unsubscriber {
    return this.firestore
      .collection('Error')
      .where('timestamp', '>', this.filters.timeRange.start)
      .limit(5)
      .orderBy('timestamp', 'desc')
      .onSnapshot(querySnapshot => {
        const changes = querySnapshot.docChanges();
        this.updateFormattedErrors(changes).then(() => {
          Render.errors(
            Object.values(PDCache.currentFilterErrors.formattedErrors)
          );
        });
      });
  }

  /**
   * Updates currentFilterErrors.formattedErrors with the given changes
   * @param changes Error document changes
   * @returns a Promise that resolves after all updates are completed
   */
  private updateFormattedErrors(changes: any[]) {
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
  private buildFormattedError(errorDoc: any) {
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

  /**
   * Initializes the static Firestore client if it
   * is not already initialized
   */
  private initFirestoreClient() {
    if (!this.firestore) {
      firebase.initializeApp({
        apiKey: 'AIzaSyCNYD0Pp6wnT36GcdxWkRVE9RTWt_2XfsU',
        authDomain: 'repo-automation-bots-metrics.firebaseapp.com',
        databaseURL: 'https://repo-automation-bots-metrics.firebaseio.com', // TODO: load from JSON
        projectId: 'repo-automation-bots-metrics',
        storageBucket: 'repo-automation-bots-metrics.appspot.com',
        messagingSenderId: '888867974133',
        appId: '1:888867974133:web:bd9986937d533731ed0ebc',
      });
      this.firestore = firebase.firestore();
    }
  }
}

/**
 * Start the Firestore listener on page load
 */
window.onload = () => {
  new FirestoreListener().resetListeners();
};

/**
 * TODO: Reset and start the Firestore listener
 * when user filters change
 */
