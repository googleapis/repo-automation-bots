class Firestore {

    static executionCountsByBots = {};

    static start() {
        const firestore = this._getAuthenticatedFirestore();
        this.listenToBotNames(firestore); // TODO: fix race condition b/w this line and next

        const oneHourAgo = new Date().getTime() - 60 * 60 * 1000;
        this.listenToBotExecutions(firestore, oneHourAgo);

        this.listenToErrors(firestore, oneHourAgo);
    }

    static listenToErrors(firestore, minTimestamp) {
        firestore.collection("Error")
        .where("timestamp", ">", minTimestamp)
        .limit(10)
        .orderBy("timestamp")
        .onSnapshot(querySnapshot => {
            const errors = querySnapshot.docs.map(doc => {
                const executionId = doc.data().execution_id;
                return firestore.collection("Bot_Execution")
                .doc(executionId).get()
                .then(executionDoc => {
                    const msg = doc.data().error_msg;
                    const time = doc.data().timestamp;
                    const botName = executionDoc.data().bot_name;
                    console.log(executionDoc.data());
                    return {
                        msg: String(msg).substring(0, 100) + "...",
                        time: new Date(time).toLocaleTimeString(),
                        logsUrl: executionDoc.data().logs_url,
                        botName: botName,
                    };
                });                
            })
            Promise.all(errors).then(errors => {
                console.log(errors);
                Render.errors(errors);
            });
        })
    }

    /**
     * Sets a listener for Bot Executions that start after minTimestamp
     * @param {Firestore} firestore authenticated firestore client
     * @param {Number} minTimestamp the minimum start time of Bot Executions to listen for
     */
    static listenToBotExecutions(firestore, minTimestamp) {
        firestore.collection("Bot_Execution")
            .where("start_time", ">", minTimestamp)
            .onSnapshot(querySnapshot => {
                const changes = querySnapshot.docChanges()
                changes.forEach(change => {
                    const botName = change.doc.data().bot_name;
                    if (change.type === "added") {
                        if (!this.executionCountsByBots[botName]) {
                            this.executionCountsByBots[botName] = 0;
                        }
                        this.executionCountsByBots[botName] += 1;
                    } else if (change.type === "removed") {
                        if (!this.executionCountsByBots[botName]) {
                            this.executionCountsByBots[botName] -= 1;
                        }
                    }
                })
                Render.executionsByBot(this.executionCountsByBots);
            })
    }

    /**
     * Retrieves the list of all bot names and sets the appropriate
     * labels on the document
     * @param {Firestore} firestore an authenticated Firestore client
     */
    static listenToBotNames(firestore) {
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