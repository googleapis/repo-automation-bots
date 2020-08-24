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

import {Render} from '../render/render';
import {ProcessedDataCache as PDCache} from '../query-data/processed-data-cache';

import {
  FirestoreCollection,
  TaskQueueStatusDocument,
} from '../types/firestore-schema';
import {UserFilters} from '..';
import {ChangeProcessor} from '../query-data/change-processor';
import {AuthenticatedFirestore, Firestore} from './firestore-client';

/**
 * A function returned by a listener that can be called
 * to remove that listener
 */
type Unsubscriber = () => void;

/**
 * Listens to data from Firestore and renders results
 */
export class FirestoreListener {
  /* Authenticated Firestore client */
  private firestore: Firestore;

  /* The current user filters */
  private filters: UserFilters;

  /* Callback functions to remove current listeners */
  private unsubscribers: Unsubscriber[] = [];

  constructor() {
    this.firestore = AuthenticatedFirestore.getClient();
  }

  /**
   * Sets listeners on Firestore based on the current user filters
   * and renders the results
   * @param {UserFilters} filters the current user data filters
   */
  public resetListeners(filters: UserFilters) {
    this.removeOldListeners();
    this.filters = filters;
    this.setNewListeners();
  }

  /**
   * Unsubscribes the old listeners from the Firestore queries
   */
  private removeOldListeners() {
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];
  }

  /**
   * Sets new listeners on the Firestore queries
   */
  private setNewListeners() {
    this.unsubscribers.push(
      this.listenToBotExecutions(),
      this.listenToErrors(),
      this.listenToTaskQueueStatus(),
      this.listenToActions()
    );  
  }

  /**
   * Listens to Bot Execution docs from Firestore that match user filters
   */
  private listenToBotExecutions(): Unsubscriber {
    return this.firestore
      .collection(FirestoreCollection.BotExecution)
      .where('start_time', '>', this.filters.timeRange.start)
      .onSnapshot(querySnapshot => {
        ChangeProcessor.processExecutionDocChanges(querySnapshot.docChanges());
        Render.executionsByBot(PDCache.Executions.countByBot);
      },
      error => {
        console.log(error);
        Render.showUnauthorizedMessage();
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
        const changes = querySnapshot.docChanges();
        ChangeProcessor.processActionDocChanges(changes).then(() => {
          Render.actions(Object.values(PDCache.Actions.actionInfos));
        });
      },
      error => {
        console.log(error);
        Render.showUnauthorizedMessage();
      });
  }

  /**
   * Sets a listener for the Task Queue status that match the current user filters
   */
  private listenToTaskQueueStatus(): Unsubscriber {
    return (
      this.firestore
        .collection(FirestoreCollection.TaskQueueStatus)
        .orderBy('timestamp', 'desc')
        .limit(1)
        /* Listens for when the most recent timestamp changes */
        .onSnapshot(querySnapshot => {
          const mostRecentDoc = querySnapshot.docs[0].data() as TaskQueueStatusDocument;
          const mostRecentTimestamp = mostRecentDoc.timestamp;
          this.getTaskStatusWithTimestamp(mostRecentTimestamp).then(
            taskStatusDocs => {
              const byBot: {[botName: string]: number} = {};
              taskStatusDocs.forEach(doc => {
                const botName = doc.queue_name.replace(/-/g, '_');
                byBot[botName] = doc.in_queue;
              });
              Render.tasksByBot(byBot);
            }
          );
        },
        error => {
          console.log(error);
          Render.showUnauthorizedMessage();
        })
    );
  }

  /**
   * Gets all the TaskQueueStatusDocuments from firestore with the given timestamp
   * @param timestamp timestamp to filter by
   */
  private getTaskStatusWithTimestamp(
    timestamp: number
  ): Promise<TaskQueueStatusDocument[]> {
    return this.firestore
      .collection(FirestoreCollection.TaskQueueStatus)
      .where('timestamp', '==', timestamp)
      .get()
      .then(results => {
        return results.docs.map(doc => doc.data() as TaskQueueStatusDocument);
      });
  }

  /**
   * Sets a listener for execution errors that match the current user filters
   * Limits to 5 errors
   */
  private listenToErrors(): Unsubscriber {
    return this.firestore
      .collection(FirestoreCollection.Error)
      .where('timestamp', '>', this.filters.timeRange.start)
      .limit(5)
      .orderBy('timestamp', 'desc')
      .onSnapshot(querySnapshot => {
        const changes = querySnapshot.docChanges();
        ChangeProcessor.processErrorDocChanges(changes).then(() => {
          Render.errors(Object.values(PDCache.Errors.errorInfos));
        });
      },
      error => {
        console.log(error);
        Render.showUnauthorizedMessage();
      });
  }
}
