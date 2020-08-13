class Render {

    /**
     * Rows that contain statistics 'By Bot' and need bot names
     * as labels underneath stats
     */
    static statRowsByBot = [
        'stat_executions_last_hour_by_bot',
        'stat_tasks_by_bot',
    ]

    /**
     * Adds the labels for the given bots
     * @param {Array<string>} botNames names of bots to add labels for
     */
    static addBotNameLabels(botNames) {
        for (const rowId of this.statRowsByBot) {
            const row = document.getElementById(rowId);
            row.innerHTML = "";
            for (const name of botNames) {
                const labelCell = row.insertCell(-1);
                labelCell.innerHTML = `<p class="stat" id="${name}">-</p><p class="label" id="${name}">${name}</p>`;
            }
        }
    }

    /**
     * Renders the execution counts for given bots
     * @param {[bot_name: string]: number} executionCounts a map of bot_name to execution counts
     */
    static executionsByBot(executionCounts) {
        for (const botName of Object.keys(executionCounts)) {
            const xPath = `//tr[@id="stat_executions_last_hour_by_bot"]//p[contains(@class, "stat") and @id="${botName}"]`;
            const statP = this.getElementByXpath(xPath)
            statP.innerHTML = String(executionCounts[botName])
        }
    }

    /**
     * Renders the given errors
     * @param {msg: string, botName: string, logsUrl: string, time: string} errors errors to render
     */
    static errors(errors) {
        const xPath = `//tr[@id="stat_errors_last_hour"]/td`;
        const errorsTd = this.getElementByXpath(xPath);
        var errorsHTML = ''
        for (const error of errors) {
            const div = `<div class="error_div" onclick="window.open('${error.logsUrl}','blank');"><p class="error_text">(${error.time}) ${error.botName}: ${error.msg}</p></div>`
            errorsHTML += div;
        }
        errorsTd.innerHTML = errorsHTML;
    }

    /**
     * Finds the element referenced by the given XPath in the document
     * @param {String} xPath XPath reference to node
     */
    static getElementByXpath(xPath) {
        return document.evaluate(xPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }
}