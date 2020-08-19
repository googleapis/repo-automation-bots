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

import { Render } from "./render";
import { ProcessedDataCache as PDCache} from "./processed-data-cache";
import * as firebase from "firebase/app";

/** Required for Firestore capabilities */
import 'firebase/firestore';
import { FirestoreCollection, BotExecutionDocument } from "./firestore-schema";

type Firestore = firebase.firestore.Firestore;
type DocumentChange<T> = firebase.firestore.DocumentChange;
type DocumentData = firebase.firestore.DocumentData;

/**
 * Filters on metrics set by the user
 */
interface UserFilters {
    timeRange?: {
        start?: number, // UNIX timestamp
        end?: number, // UNIX timestamp
    }
}

class FirestoreListener {

    private static firestore: Firestore;

    /**
     * Sets listeners on Firestore based on the current user filters
     */
    public static start() {
        const firestore = this.getAuthenticatedFirestore();
        const filters = this.getCurrentUserFilters();

        this.listenToBotExecutions(firestore, filters);
        this.listenToErrors(firestore, filters);
        this.listenToTaskQueueStatus(firestore, filters);
        this.listenToActions(firestore, filters);
    }

    /**
     * Returns the current data filters set by the user
     * 
     * NOTE: NOT IMPLEMENTED
     * Currently this just returns fixed values
     */
    private static getCurrentUserFilters(): UserFilters {
        return {
            timeRange: {
                start: new Date().getTime() - 60 * 60 * 1000
            }
        }
    }

    /**
     * Listens to Bot Execution docs from Firestore that match user filters
     * @param firestore Firestore client
     * @param filters current user filters
     */
    private static listenToBotExecutions(firestore: Firestore, filters: UserFilters) {
        firestore.collection(FirestoreCollection.BotExecution)
            .where("start_time", ">", filters.timeRange.start)
            .onSnapshot(querySnapshot => {
                this.updateExecutionCountsByBot(querySnapshot.docChanges())
                Render.executionsByBot(PDCache.Executions.countByBot);
            })
    }

    /**
     * Updates Execution counts in Processed Data Cache
     * @param changes Bot_Execution document changes
     */
    private static updateExecutionCountsByBot(changes: Array<DocumentChange<DocumentData>>) {
        const countByBot = PDCache.Executions.countByBot;
        changes.forEach(change => {
            const botExecutionDoc = change.doc.data() as BotExecutionDocument;
            const botName = botExecutionDoc.bot_name;
            if (!countByBot[botName]) {
                countByBot[botName] = 0;
            }
            if (change.type === "added") {
                countByBot[botName]++;
            } else if (change.type === "removed") {
                countByBot[botName]--;
            }
        })
    }

    /**
     * Listens to Action docs from Firestore that match user filters
     * @param firestore Firestore client
     * @param filters current user filters
     */
    private static listenToActions(firestore: Firestore, filters: UserFilters) {
        firestore.collection(FirestoreCollection.Action)
            .where("timestamp", ">", filters.timeRange.start)
            .onSnapshot((querySnapshot: any) => {
                const changes = querySnapshot.docChanges();
                this.updateFormattedActions(changes, firestore).then(() => {
                    Render.actions(Object.values(PDCache.currentFilterActions.formattedActions));
                });
            });
    }

    // TODO: JSDocs
    private static updateFormattedActions(changes: any, firestore: Firestore) {
        const formattedActions: any = PDCache.currentFilterActions.formattedActions;
        const updates = changes.map((change: any) => {
            const doc = change.doc.data();
            const primaryKey = `${doc.execution_id}_${doc.action_type}_${doc.timestamp}`;
            if (change.type === "removed" && formattedActions[primaryKey]) {
                delete formattedActions[primaryKey];
                return Promise.resolve();
            } else if (change.type === "added") {
                return this._buildFormattedAction(doc, firestore).then((formattedDoc: any) => {
                    formattedActions[primaryKey] = formattedDoc;
                })
            }
        })
        return Promise.all(updates);  // TODO will short-circuit
    }

    private static _buildFormattedAction(actionDoc: any, firestore: Firestore) {
        const repo = actionDoc.destination_repo;
        const object = actionDoc.destination_object;
        return firestore.collection("GitHub_Repository")  // TODO could check local cache
            .doc(repo).get()
            .then((repoDoc: any) => {
                let name = `${repoDoc.data().owner_name}/${repoDoc.data().repo_name}`
                const time = actionDoc.timestamp;
                const url = `https://github.com/${name}`;
                if (repoDoc.data().private) {
                    name = `${name} [private repository]`;
                }
                return {
                    repoName: name,
                    time: new Date(time).toLocaleTimeString(),
                    url: url,
                    action: `${actionDoc.action_type}${actionDoc.value === "NONE" ? "" : ": " + actionDoc.value}`,
                };
            })
            .then((formattedAction: any) => {
                if (object) {  // TODO: replace with actual call to firestore
                    const parts = object.split("_");
                    if (object.includes("PULL_REQUEST")) {
                        formattedAction.url += `/pulls/${parts[parts.length - 1]}`
                    } else if (object.includes("ISSUE")) {
                        formattedAction.url += `/issues/${parts[parts.length - 1]}`
                    }
                }
                return formattedAction;
            });
    }

    /**
     * Sets a listener for the Task Queue status that match the current user filters
     * @param {FirestoreListener} firestore authenticated firestore client
     * @param filters the current user filters
     */
    private static listenToTaskQueueStatus(firestore: Firestore, filters: UserFilters) {
        // TODO: currently this just grabs the first 20 records
        // change it so that it finds the latest timestamp and gets
        // all records with that timestamp
        firestore.collection("Task_Queue_Status")
            .orderBy("timestamp", "desc")
            .limit(20)
            .onSnapshot((querySnapshot: any) => {
                const byBot: any = {};
                const docs = querySnapshot.docs.map((doc: any) => doc.data());
                docs.forEach((doc: any) => {
                    const botName = doc.queue_name.replace(/-/g, "_");
                    if (!byBot[botName]) {
                        byBot[botName] = doc.in_queue;
                    }
                });
                Render.tasksByBot(byBot);
            })
    }

    /**
     * Builds trigger docs with the given changes and stores them 
     * in currentFilterTriggers.docs 
     * @param changes Bot_Execution document changes
     * @returns a Promise that resolves when all trigger docs are built and stored
     */
    private static buildTriggerDocs(changes: any[], firestore: Firestore) {
        const triggerDocs: any = PDCache.currentFilterTriggers.docs;
        const countByType: any = PDCache.currentFilterTriggers.countByType;
        const updates: any = changes.map(change => {
            const executionId = change.doc.data().execution_id;
            if (change.type === "removed" && triggerDocs[executionId]) {
                const type = triggerDocs[executionId].trigger_type;
                countByType[type] -= 1
                delete triggerDocs[executionId];
                return Promise.resolve();
            } else if (change.type === "added") {
                return firestore.collection("Trigger").doc(executionId).get()
                    .then((doc: any) => {
                        if (doc.exists) {
                            const type = doc.data().trigger_type;
                            triggerDocs[executionId] = doc.data();
                            countByType[type] += 1
                        }
                    })
            }
        })
        return Promise.all(updates); // TODO will short-circuit
    }

    /**
     * Sets a listener for execution errors that match the current user filters
     * @param {FirestoreListener} firestore authenticated firestore client
     * @param filters the current user filters
     */
    private static listenToErrors(firestore: Firestore, filters: UserFilters) {
        firestore.collection("Error")
            .where("timestamp", ">", filters.timeRange.start)
            .limit(5)
            .orderBy("timestamp", "desc")
            .onSnapshot((querySnapshot: any) => {
                const changes = querySnapshot.docChanges();
                this.updateFormattedErrors(changes, firestore).then(() => {
                    Render.errors(Object.values(PDCache.currentFilterErrors.formattedErrors));
                });
            })
    }

    /**
     * Updates currentFilterErrors.formattedErrors with the given changes
     * @param changes Error document changes
     * @returns a Promise that resolves after all updates are completed
     */
    private static updateFormattedErrors(changes: any[], firestore: Firestore) {
        const formattedErrors: any = PDCache.currentFilterErrors.formattedErrors;
        const updates = changes.map(change => {
            const doc = change.doc.data();
            const primaryKey = `${doc.execution_id}_${doc.timestamp}`;
            if (change.type === "removed" && formattedErrors[primaryKey]) {
                delete formattedErrors[primaryKey];
                return Promise.resolve();
            } else if (change.type === "added") {
                return this.buildFormattedError(doc, firestore).then((formattedDoc: any) => {
                    formattedErrors[primaryKey] = formattedDoc;
                })
            }
        })
        return Promise.all(updates);  // TODO will short-circuit
    }

    /**
     * Builds a formatted error document from an error document
     * @param errorDoc error document from Firestore
     * @returns a Promise that resolves the formatted document
     */
    private static buildFormattedError(errorDoc: any, firestore: Firestore) {
        const executionId = errorDoc.execution_id;
        return firestore.collection("Bot_Execution")  // TODO could check local cache
            .doc(executionId).get()
            .then((executionDoc: any) => {
                const msg = errorDoc.error_msg;
                const time = errorDoc.timestamp;
                const botName = executionDoc.data().bot_name;
                return {
                    msg: String(msg).substring(0, 200) + "...",
                    time: new Date(time).toLocaleTimeString(),
                    logsUrl: executionDoc.data().logs_url,
                    botName: botName,
                };
            });
    }

    /**
     * Returns an authenticated Firestore client.
     * Only initializes one client per session.
     */
    private static getAuthenticatedFirestore(): Firestore {
        if (!this.firestore) {
            firebase.initializeApp({
                "apiKey": "AIzaSyCNYD0Pp6wnT36GcdxWkRVE9RTWt_2XfsU",
                "authDomain": "repo-automation-bots-metrics.firebaseapp.com",
                "databaseURL": "https://repo-automation-bots-metrics.firebaseio.com",
                "projectId": "repo-automation-bots-metrics",
                "storageBucket": "repo-automation-bots-metrics.appspot.com",
                "messagingSenderId": "888867974133",
                "appId": "1:888867974133:web:bd9986937d533731ed0ebc"
            });
            this.firestore = firebase.firestore();
        }
        return this.firestore;
    }
}

window.onload = () => {
    FirestoreListener.start();
    // Render.taskQueueTrend([
    //     {x: 0, y: 13},
    //     {x: 1, y: 2},
    //     {x: 2, y: 33},
    //     {x: 3, y: 24},
    //     {x: 4, y: 15},
    //     {x: 5, y: 3},
    // ])
}