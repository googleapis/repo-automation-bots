class Firestore {

    static start() {
        const firestore = this._getAuthenticatedFirestore();
        this.listenToBotNames(firestore);

        const oneHour = 60*60*1000;
        firestore.collection("Bot_Execution").where("start_time", ">", new Date().getTime()-oneHour).onSnapshot(snap => {
            const executionCountsByBots = {};
            snap.forEach(doc => {
                const botName = doc.data().bot_name;
                if (!executionCountsByBots[botName]) {
                    executionCountsByBots[botName] = 0;
                }
                executionCountsByBots[botName] +=1;
            })
            Render.executionsLastHourByBot(executionCountsByBots);
        })

        firestore.collection("Trigger").onSnapshot(snap => {
            const executionCountsByTrigger = {};
            snap.forEach(doc => {
                const triggerType = doc.data().trigger_type;
                if (!executionCountsByTrigger[triggerType]) {
                    executionCountsByTrigger[triggerType] = 0;
                }
                executionCountsByTrigger[triggerType] +=1;
            })
            Render.executionsLastHourByTrigger(executionCountsByTrigger);
        })
    }

    /**
     * Creates and returns an authenticated Firestore client
     */
    static _getAuthenticatedFirestore() {
        var firebaseConfig = {
            apiKey: "REMOVED",
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

    /**
     * Retrieves the list of all bot names and sets the appropriate
     * labels on the document
     * @param firestore an authenticated Firestore client
     */
    static listenToBotNames(firestore) {
        firestore.collection("Bot").onSnapshot(querySnapshot => {
            const names = querySnapshot.docs.map(doc => doc.data().bot_name);
            Render.botNameLabels(names);
        })
    }

    // static listenToExecutionCounts(firestore) {
    //     firestore.collection("Bot_Execution").onSnapshot(querySnapshot => {

    //     })
    // }
}