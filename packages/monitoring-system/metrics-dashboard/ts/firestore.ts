import {Render} from "./render";
const firebase = require("firebase");
// Required for side-effects
require("firebase/firestore");

export class Firestore {

    /**
     * Bot_Executions that match the current user filters
     */
    static currentFilterExecutions = {
        docs: {},                     // the execution documents
        countByBot: {}                // count of number of executions by bot
    };

    static currentFilterErrors = {
        formattedErrors: {}           // errors formatted with execution info
    }

    static currentFilterTriggers = {
        docs: {},
        countByType: {},
    }

    static currentFilterActions = {
        formattedActions: {}          // actions formatted with repo info
    }

    /**
     * Sets listeners on Firestore based on the current user filters
     */
    static start() {   // TODO: rename to something like refreshListeners()
        const firestore = this._getAuthenticatedFirestore(); // TODO: move to an init() method
        const filters = this._getCurrentUserFilters();
        this._listenToBotNames(firestore); // TODO: fix race condition b/w this line and next
        this._listenToBotExecutions(firestore, filters);
        this._listenToErrors(firestore, filters);
        this._listenToTaskQueueStatus(firestore, filters);
        this._listenToActions(firestore, filters);
    }

    /**
     * Returns the current data filters set by the user
     * 
     * NOTE: NOT IMPLEMENTED
     * Currently this just returns fixed values
     */
    static _getCurrentUserFilters() {
        return {
            START_TIME: new Date().getTime() - 60 * 60 * 1000,
            // REPOSITORY_NAME: "All Repositories",
            // ORG_NAME: "All Organizations",
            // BOT_NAME: "All Bots"
        }
    }

    // TODO: JSDocs
    static _listenToActions(firestore, filters) {
        firestore.collection("Action")
            .where("timestamp", ">", filters.START_TIME)
            .onSnapshot(querySnapshot => {
                const changes = querySnapshot.docChanges();
                this._updateFormattedActions(changes, firestore).then(() => {
                    Render.actions(Object.values(this.currentFilterActions.formattedActions));
                });
            });
    }

    // TODO: JSDocs
    static _updateFormattedActions(changes, firestore) {
        const formattedActions = this.currentFilterActions.formattedActions;
        const updates = changes.map(change => {
            const doc = change.doc.data();
            const primaryKey = `${doc.execution_id}_${doc.action_type}_${doc.timestamp}`;
            if (change.type === "removed" && formattedActions[primaryKey]) {
                delete formattedActions[primaryKey];
                return Promise.resolve();
            } else if (change.type === "added") {
                return this._buildFormattedAction(doc, firestore).then(formattedDoc => {
                    formattedActions[primaryKey] = formattedDoc;
                })
            }
        })
        return Promise.all(updates);  // TODO will short-circuit
    }

    static _buildFormattedAction(actionDoc, firestore) {
        const repo = actionDoc.destination_repo;
        const object = actionDoc.destination_object;
        return firestore.collection("GitHub_Repository")  // TODO could check local cache
            .doc(repo).get()
            .then(repoDoc => {
                let name = `${repoDoc.data().owner_name}/${repoDoc.data().repo_name}`
                const time = actionDoc.timestamp;
                const url = `https://github.com/${name}`;
                if (repoDoc.data().private) {
                    name = `${name} [private repository]`;
                }
                return {
                    repoName: name,
                    time: new Date(time).toLocaleTimeString(),
                    url:url,
                    action: `${actionDoc.action_type}${actionDoc.value === "NONE" ? "" : ": " + actionDoc.value}`,
                };
            })
            .then(formattedAction => {
                if (object) {  // TODO: replace with actual call to firestore
                    const parts = object.split("_");
                    if (object.includes("PULL_REQUEST")) {
                        formattedAction.url += `/pulls/${parts[parts.length-1]}`
                    } else if (object.includes("ISSUE")) {
                        formattedAction.url += `/issues/${parts[parts.length-1]}`
                    }
                }
                return formattedAction;
            });
    }

    /**
     * Sets a listener for Bot Executions that match the current user filters
     * @param {Firestore} firestore authenticated firestore client
     * @param filters the current user filters
     */
    static _listenToBotExecutions(firestore, filters) {
        firestore.collection("Bot_Execution")
            .where("start_time", ">", filters.START_TIME)
            .onSnapshot(querySnapshot => {
                const currentFilterDocs = this.currentFilterExecutions.docs;
                querySnapshot.docChanges().forEach(change => {
                    if (change.type === "added") {
                        currentFilterDocs[change.doc.execution_id] = change.doc;
                    } else if (change.type === "removed" && currentFilterDocs[change.doc.execution_id]) {
                        delete currentFilterDocs[change.doc.execution_id];
                    }
                });

                // TODO: enabling this breaks the firestore client
                // this._buildTriggerDocs(querySnapshot.docChanges(), firestore).then(() => {
                //     Render.executionsByTrigger(this.currentFilterTriggers.countByType);
                // })

                this._updateExecutionCountsByBot(querySnapshot.docChanges())
                Render.executionsByBot(this.currentFilterExecutions.countByBot);
            })
    }

    /**
     * Sets a listener for the Task Queue status that match the current user filters
     * @param {Firestore} firestore authenticated firestore client
     * @param filters the current user filters
     */
    static _listenToTaskQueueStatus(firestore, filters) {
        // TODO: currently this just grabs the first 20 records
        // change it so that it finds the latest timestamp and gets
        // all records with that timestamp
        firestore.collection("Task_Queue_Status")
            .orderBy("timestamp", "desc")
            .limit(20)
            .onSnapshot(querySnapshot => {
                const byBot = {};
                const docs = querySnapshot.docs.map(doc => doc.data());
                docs.forEach(doc => {
                    const botName = doc.queue_name.replace(/-/g, "_");
                    if (!byBot[botName]) {
                        byBot[botName] = doc.in_queue;
                    }
                });
                Render.tasksByBot(byBot);
            })
    }

    /**
     * Updates currentFilterExecutions.countByBot with the given changes
     * @param changes Bot_Execution document changes
     */
    static _updateExecutionCountsByBot(changes) {
        const countByBot = this.currentFilterExecutions.countByBot;
        changes.forEach(change => {
            const botName = change.doc.data().bot_name;
            if (!countByBot[botName]) {
                countByBot[botName] = 0;
            }
            const currCount = countByBot[botName];
            if (change.type === "added") {
                countByBot[botName] = currCount + 1;
            } else if (change.type === "removed") {
                countByBot[botName] = Math.max(0, currCount - 1);
            }
        })
    }

    /**
     * Builds trigger docs with the given changes and stores them 
     * in currentFilterTriggers.docs 
     * @param changes Bot_Execution document changes
     * @returns a Promise that resolves when all trigger docs are built and stored
     */
    static _buildTriggerDocs(changes, firestore) {
        const triggerDocs = this.currentFilterTriggers.docs;
        const countByType = this.currentFilterTriggers.countByType;
        const updates = changes.map(change => {
            const executionId = change.doc.data().execution_id;
            if (change.type === "removed" && triggerDocs[executionId]) {
                const type = triggerDocs[executionId].trigger_type;
                countByType[type] -= 1
                delete triggerDocs[executionId];
                return Promise.resolve();
            } else if (change.type === "added") {
                return firestore.collection("Trigger").doc(executionId).get()
                    .then(doc => {
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
     * @param {Firestore} firestore authenticated firestore client
     * @param filters the current user filters
     */
    static _listenToErrors(firestore, filters) {
        firestore.collection("Error")
            .where("timestamp", ">", filters.START_TIME)
            .limit(5)
            .orderBy("timestamp", "desc")
            .onSnapshot(querySnapshot => {
                const changes = querySnapshot.docChanges();
                this._updateFormattedErrors(changes, firestore).then(() => {
                    Render.errors(Object.values(this.currentFilterErrors.formattedErrors));
                });
            })
    }

    /**
     * Updates currentFilterErrors.formattedErrors with the given changes
     * @param changes Error document changes
     * @returns a Promise that resolves after all updates are completed
     */
    static _updateFormattedErrors(changes, firestore) {
        const formattedErrors = this.currentFilterErrors.formattedErrors;
        const updates = changes.map(change => {
            const doc = change.doc.data();
            const primaryKey = `${doc.execution_id}_${doc.timestamp}`;
            if (change.type === "removed" && formattedErrors[primaryKey]) {
                delete formattedErrors[primaryKey];
                return Promise.resolve();
            } else if (change.type === "added") {
                return this._buildFormattedError(doc, firestore).then(formattedDoc => {
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
    static _buildFormattedError(errorDoc, firestore) {
        const executionId = errorDoc.execution_id;
        return firestore.collection("Bot_Execution")  // TODO could check local cache
            .doc(executionId).get()
            .then(executionDoc => {
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
     * Retrieves the list of all bot names and sets the appropriate
     * labels on the document
     * @param {Firestore} firestore an authenticated Firestore client
     */
    static _listenToBotNames(firestore) {   // TODO: use filters and cache
        firestore.collection("Bot")
            .onSnapshot(querySnapshot => {
                const names = querySnapshot.docs.map(doc => doc.data().bot_name);
                Render.addBotNameLabels(names);
            })
    }

    /**
     * Creates and returns an authenticated Firestore client
     */
    static _getAuthenticatedFirestore() {
        var firebaseConfig = {
            apiKey: "AIzaSyCNYD0Pp6wnT36GcdxWkRVE9RTWt_2XfsU",
            authDomain: "repo-automation-bots-metrics.firebaseapp.com",
            databaseURL: "https://repo-automation-bots-metrics.firebaseio.com",
            projectId: "repo-automation-bots-metrics",
            storageBucket: "repo-automation-bots-metrics.appspot.com",
            messagingSenderId: "888867974133",
            appId: "1:888867974133:web:bd9986937d533731ed0ebc"
        };
        // Initialize Firebase
        firebase.initializeApp(firebaseConfig);
        return firebase.firestore();
    }
}