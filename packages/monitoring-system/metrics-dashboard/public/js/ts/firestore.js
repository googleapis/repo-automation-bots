"use strict";
exports.__esModule = true;
exports.Firestore = void 0;
var render_1 = require("./render");
var firebase = require("firebase");
// Required for side-effects
require("firebase/firestore");
var Firestore = /** @class */ (function () {
    function Firestore() {
    }
    /**
     * Sets listeners on Firestore based on the current user filters
     */
    Firestore.start = function () {
        var firestore = this._getAuthenticatedFirestore(); // TODO: move to an init() method
        var filters = this._getCurrentUserFilters();
        this._listenToBotNames(firestore); // TODO: fix race condition b/w this line and next
        this._listenToBotExecutions(firestore, filters);
        this._listenToErrors(firestore, filters);
        this._listenToTaskQueueStatus(firestore, filters);
        this._listenToActions(firestore, filters);
    };
    /**
     * Returns the current data filters set by the user
     *
     * NOTE: NOT IMPLEMENTED
     * Currently this just returns fixed values
     */
    Firestore._getCurrentUserFilters = function () {
        return {
            START_TIME: new Date().getTime() - 60 * 60 * 1000
        };
    };
    // TODO: JSDocs
    Firestore._listenToActions = function (firestore, filters) {
        var _this = this;
        firestore.collection("Action")
            .where("timestamp", ">", filters.START_TIME)
            .onSnapshot(function (querySnapshot) {
            var changes = querySnapshot.docChanges();
            _this._updateFormattedActions(changes, firestore).then(function () {
                render_1.Render.actions(Object.values(_this.currentFilterActions.formattedActions));
            });
        });
    };
    // TODO: JSDocs
    Firestore._updateFormattedActions = function (changes, firestore) {
        var _this = this;
        var formattedActions = this.currentFilterActions.formattedActions;
        var updates = changes.map(function (change) {
            var doc = change.doc.data();
            var primaryKey = doc.execution_id + "_" + doc.action_type + "_" + doc.timestamp;
            if (change.type === "removed" && formattedActions[primaryKey]) {
                delete formattedActions[primaryKey];
                return Promise.resolve();
            }
            else if (change.type === "added") {
                return _this._buildFormattedAction(doc, firestore).then(function (formattedDoc) {
                    formattedActions[primaryKey] = formattedDoc;
                });
            }
        });
        return Promise.all(updates); // TODO will short-circuit
    };
    Firestore._buildFormattedAction = function (actionDoc, firestore) {
        var repo = actionDoc.destination_repo;
        var object = actionDoc.destination_object;
        return firestore.collection("GitHub_Repository") // TODO could check local cache
            .doc(repo).get()
            .then(function (repoDoc) {
            var name = repoDoc.data().owner_name + "/" + repoDoc.data().repo_name;
            var time = actionDoc.timestamp;
            var url = "https://github.com/" + name;
            if (repoDoc.data().private) {
                name = name + " [private repository]";
            }
            return {
                repoName: name,
                time: new Date(time).toLocaleTimeString(),
                url: url,
                action: "" + actionDoc.action_type + (actionDoc.value === "NONE" ? "" : ": " + actionDoc.value)
            };
        })
            .then(function (formattedAction) {
            if (object) { // TODO: replace with actual call to firestore
                var parts = object.split("_");
                if (object.includes("PULL_REQUEST")) {
                    formattedAction.url += "/pulls/" + parts[parts.length - 1];
                }
                else if (object.includes("ISSUE")) {
                    formattedAction.url += "/issues/" + parts[parts.length - 1];
                }
            }
            return formattedAction;
        });
    };
    /**
     * Sets a listener for Bot Executions that match the current user filters
     * @param {Firestore} firestore authenticated firestore client
     * @param filters the current user filters
     */
    Firestore._listenToBotExecutions = function (firestore, filters) {
        var _this = this;
        firestore.collection("Bot_Execution")
            .where("start_time", ">", filters.START_TIME)
            .onSnapshot(function (querySnapshot) {
            var currentFilterDocs = _this.currentFilterExecutions.docs;
            querySnapshot.docChanges().forEach(function (change) {
                if (change.type === "added") {
                    currentFilterDocs[change.doc.execution_id] = change.doc;
                }
                else if (change.type === "removed" && currentFilterDocs[change.doc.execution_id]) {
                    delete currentFilterDocs[change.doc.execution_id];
                }
            });
            // TODO: enabling this breaks the firestore client
            // this._buildTriggerDocs(querySnapshot.docChanges(), firestore).then(() => {
            //     Render.executionsByTrigger(this.currentFilterTriggers.countByType);
            // })
            _this._updateExecutionCountsByBot(querySnapshot.docChanges());
            render_1.Render.executionsByBot(_this.currentFilterExecutions.countByBot);
        });
    };
    /**
     * Sets a listener for the Task Queue status that match the current user filters
     * @param {Firestore} firestore authenticated firestore client
     * @param filters the current user filters
     */
    Firestore._listenToTaskQueueStatus = function (firestore, filters) {
        // TODO: currently this just grabs the first 20 records
        // change it so that it finds the latest timestamp and gets
        // all records with that timestamp
        firestore.collection("Task_Queue_Status")
            .orderBy("timestamp", "desc")
            .limit(20)
            .onSnapshot(function (querySnapshot) {
            var byBot = {};
            var docs = querySnapshot.docs.map(function (doc) { return doc.data(); });
            docs.forEach(function (doc) {
                var botName = doc.queue_name.replace(/-/g, "_");
                if (!byBot[botName]) {
                    byBot[botName] = doc.in_queue;
                }
            });
            render_1.Render.tasksByBot(byBot);
        });
    };
    /**
     * Updates currentFilterExecutions.countByBot with the given changes
     * @param changes Bot_Execution document changes
     */
    Firestore._updateExecutionCountsByBot = function (changes) {
        var countByBot = this.currentFilterExecutions.countByBot;
        changes.forEach(function (change) {
            var botName = change.doc.data().bot_name;
            if (!countByBot[botName]) {
                countByBot[botName] = 0;
            }
            var currCount = countByBot[botName];
            if (change.type === "added") {
                countByBot[botName] = currCount + 1;
            }
            else if (change.type === "removed") {
                countByBot[botName] = Math.max(0, currCount - 1);
            }
        });
    };
    /**
     * Builds trigger docs with the given changes and stores them
     * in currentFilterTriggers.docs
     * @param changes Bot_Execution document changes
     * @returns a Promise that resolves when all trigger docs are built and stored
     */
    Firestore._buildTriggerDocs = function (changes, firestore) {
        var triggerDocs = this.currentFilterTriggers.docs;
        var countByType = this.currentFilterTriggers.countByType;
        var updates = changes.map(function (change) {
            var executionId = change.doc.data().execution_id;
            if (change.type === "removed" && triggerDocs[executionId]) {
                var type = triggerDocs[executionId].trigger_type;
                countByType[type] -= 1;
                delete triggerDocs[executionId];
                return Promise.resolve();
            }
            else if (change.type === "added") {
                return firestore.collection("Trigger").doc(executionId).get()
                    .then(function (doc) {
                    if (doc.exists) {
                        var type = doc.data().trigger_type;
                        triggerDocs[executionId] = doc.data();
                        countByType[type] += 1;
                    }
                });
            }
        });
        return Promise.all(updates); // TODO will short-circuit
    };
    /**
     * Sets a listener for execution errors that match the current user filters
     * @param {Firestore} firestore authenticated firestore client
     * @param filters the current user filters
     */
    Firestore._listenToErrors = function (firestore, filters) {
        var _this = this;
        firestore.collection("Error")
            .where("timestamp", ">", filters.START_TIME)
            .limit(5)
            .orderBy("timestamp", "desc")
            .onSnapshot(function (querySnapshot) {
            var changes = querySnapshot.docChanges();
            _this._updateFormattedErrors(changes, firestore).then(function () {
                render_1.Render.errors(Object.values(_this.currentFilterErrors.formattedErrors));
            });
        });
    };
    /**
     * Updates currentFilterErrors.formattedErrors with the given changes
     * @param changes Error document changes
     * @returns a Promise that resolves after all updates are completed
     */
    Firestore._updateFormattedErrors = function (changes, firestore) {
        var _this = this;
        var formattedErrors = this.currentFilterErrors.formattedErrors;
        var updates = changes.map(function (change) {
            var doc = change.doc.data();
            var primaryKey = doc.execution_id + "_" + doc.timestamp;
            if (change.type === "removed" && formattedErrors[primaryKey]) {
                delete formattedErrors[primaryKey];
                return Promise.resolve();
            }
            else if (change.type === "added") {
                return _this._buildFormattedError(doc, firestore).then(function (formattedDoc) {
                    formattedErrors[primaryKey] = formattedDoc;
                });
            }
        });
        return Promise.all(updates); // TODO will short-circuit
    };
    /**
     * Builds a formatted error document from an error document
     * @param errorDoc error document from Firestore
     * @returns a Promise that resolves the formatted document
     */
    Firestore._buildFormattedError = function (errorDoc, firestore) {
        var executionId = errorDoc.execution_id;
        return firestore.collection("Bot_Execution") // TODO could check local cache
            .doc(executionId).get()
            .then(function (executionDoc) {
            var msg = errorDoc.error_msg;
            var time = errorDoc.timestamp;
            var botName = executionDoc.data().bot_name;
            return {
                msg: String(msg).substring(0, 200) + "...",
                time: new Date(time).toLocaleTimeString(),
                logsUrl: executionDoc.data().logs_url,
                botName: botName
            };
        });
    };
    /**
     * Retrieves the list of all bot names and sets the appropriate
     * labels on the document
     * @param {Firestore} firestore an authenticated Firestore client
     */
    Firestore._listenToBotNames = function (firestore) {
        firestore.collection("Bot")
            .onSnapshot(function (querySnapshot) {
            var names = querySnapshot.docs.map(function (doc) { return doc.data().bot_name; });
            render_1.Render.addBotNameLabels(names);
        });
    };
    /**
     * Creates and returns an authenticated Firestore client
     */
    Firestore._getAuthenticatedFirestore = function () {
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
    };
    /**
     * Bot_Executions that match the current user filters
     */
    Firestore.currentFilterExecutions = {
        docs: {},
        countByBot: {} // count of number of executions by bot
    };
    Firestore.currentFilterErrors = {
        formattedErrors: {} // errors formatted with execution info
    };
    Firestore.currentFilterTriggers = {
        docs: {},
        countByType: {}
    };
    Firestore.currentFilterActions = {
        formattedActions: {} // actions formatted with repo info
    };
    return Firestore;
}());
exports.Firestore = Firestore;
