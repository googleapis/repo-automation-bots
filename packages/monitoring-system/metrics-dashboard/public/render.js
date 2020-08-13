class Render {

    /**
     * Renders labels for metrics using the given bot names
     * @param {Array<string>} botNames names of all bots
     */
    static botNameLabels(botNames) {
        const executionStatsRow = document.getElementById('stat_executions_last_hour_by_bot');

        /**
         * The current behaviour is to wipe out all old labels but
         * this could be optimized by simply adding the changed labels
         */
        executionStatsRow.innerHTML = "";
        for (const name of botNames) {
            const labelCell = executionStatsRow.insertCell(-1);
            labelCell.innerHTML = `<p class="stat" id="${name}">-</p><p class="label" id="${name}">${name}</p>`;
        }
    }

    /**
     * Renders the execution counts for given bots
     * @param {[bot_name: string]: number} executionCounts a map of bot_name to execution counts
     */
    static executionsLastHourByBot(executionCounts) {
        for (const botName of Object.keys(executionCounts)) {
            const xPath = `//tr[@id="stat_executions_last_hour_by_bot"]//p[contains(@class, "stat") and @id="${botName}"]`;
            const statP = this.getElementByXpath(xPath)
            statP.innerHTML = String(executionCounts[botName])
        }
    }

    /**
     * Renders labels for metrics using the given trigger types
     * @param {Array<string>} triggerTypes names of all trigger types
     */
    static triggerTypeLabels(triggerTypes) {
        const executionStatsRow = document.getElementById('stat_executions_last_hour_by_trigger');

        /**
         * The current behaviour is to wipe out all old labels but
         * this could be optimized by simply adding the changed labels
         */
        executionStatsRow.innerHTML = "";
        for (const type of triggerTypes) {
            const labelCell = executionStatsRow.insertCell(-1);
            labelCell.innerHTML = `<p class="stat" id="${type}">-</p><p class="label" id="${type}">${type}</p>`;
        }
    }

    static executionsLastHourByTrigger(executionCounts) {
        this.triggerTypeLabels(Object.keys(executionCounts));
        for (const triggerName of Object.keys(executionCounts)) {
            const xPath = `//tr[@id="stat_executions_last_hour_by_trigger"]//p[contains(@class, "stat") and @id="${triggerName}"]`;
            const statP = this.getElementByXpath(xPath)
            statP.innerHTML = String(executionCounts[triggerName])
        }
    }

    static getElementByXpath(xPath) {
        return document.evaluate(xPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }
}