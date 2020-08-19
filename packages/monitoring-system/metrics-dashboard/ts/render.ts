export class Render {

    /**
     * Rows that contain statistics 'By Bot' and need bot names
     * as labels underneath stats
     */
    static statRowsByBot = [
        'stat_executions_by_bot',
        'stat_tasks_by_bot',
    ]

    /**
     * Rows that contain statistics 'By Trigger' and need trigger types
     * as labels underneath stats
     */
    static statRowsByTrigger = [
        'stat_executions_by_trigger'
    ]

    /**
     * Adds the labels for the given bots
     * @param {Array<string>} botNames names of bots to add labels for
     */
    static addBotNameLabels(botNames: any) {
        for (const rowId of this.statRowsByBot) {
            const row = document.getElementById(rowId) as HTMLTableRowElement;
            row.innerHTML = "";
            const cell = row.insertCell(-1);
            var cellHTML = '';
            for (const name of botNames) {
                cellHTML += `<div class="data_div"><p class="stat" id="${name}">0</p><p class="label" id="${name}">${name}</p></div>`;
            }
            cell.innerHTML = cellHTML;
        }
    }

    static addTriggerTypeLabels(triggerTypes: any)  {
        for (const rowId of this.statRowsByTrigger) {
            const row = document.getElementById(rowId) as HTMLTableRowElement;
            row.innerHTML = "";
            for (const type of triggerTypes) {
                const labelCell = row.insertCell(-1);
                labelCell.innerHTML = `<p class="stat" id="${type}">-</p><p class="label" id="${type}">${type}</p>`;
            }
        }
    }

    /**
     * Renders the execution counts for given bots
     * @param {[bot_name: string]: number} executionCounts a map of bot_name to execution counts
     */
    static executionsByBot(executionCounts: any) {
        for (const botName of Object.keys(executionCounts)) {
            const xPath = `//tr[@id="stat_executions_by_bot"]//p[contains(@class, "stat") and @id="${botName}"]`;
            const statP = this.getElementByXpath(xPath) as HTMLElement;
            statP.innerHTML = String(executionCounts[botName])
        }
    }

    // TODO JSDoc
    static executionsByTrigger(executionCounts: any) {
        const types = Object.keys(executionCounts);
        this.addTriggerTypeLabels(types)  // TODO: optimize instead of rewriting labels each time
        for (const type of types) {
            const xPath = `//tr[@id="stat_executions_by_trigger"]//p[contains(@class, "stat") and @id="${type}"]`;
            const statP = this.getElementByXpath(xPath) as HTMLElement;
            statP.innerHTML = String(executionCounts[type])
        }
    }

    // TODO JSDoc
    static tasksByBot(taskCount: any) {
        for (const botName of Object.keys(taskCount)) {
            const xPath = `//tr[@id="stat_tasks_by_bot"]//p[contains(@class, "stat") and @id="${botName}"]`;
            const statP = this.getElementByXpath(xPath) as HTMLElement;
            statP.innerHTML = String(taskCount[botName])
        }
    }

    /**
     * Renders the given errors
     * @param {msg: string, botName: string, logsUrl: string, time: string} errors errors to render
     */
    static errors(errors: any) {
        const xPath = `//tr[@id="stat_errors"]/td`;
        const errorsTd = this.getElementByXpath(xPath) as HTMLElement;
        var errorsHTML = '';
        errors.sort((e1: any, e2: any) => new Date(e2.time).getTime() - new Date(e1.time).getTime());
        errors = errors.slice(0, 5);
        for (const error of errors) {
            const div = `<div class="error_div object_div" onclick="window.open('${error.logsUrl}','blank');"><p class="error_text object_text"><strong>(${error.time}) ${error.botName}:</strong></br> ${error.msg}</p></div>`
            errorsHTML += div;
        }
        errorsTd.innerHTML = errorsHTML;
    }

    /**
     * Renders the given actions
     * @param {repoName: string, url: string, action: string, time: string} actions actions to render
     */
    static actions(actions: any) {
        const xPath = `//tr[@id="stat_actions"]/td`;
        const actionsTd = this.getElementByXpath(xPath) as HTMLElement;
        var actionsHTML = '';
        actions.sort((a1: any, a2: any) => new Date(a2.time).getTime() - new Date(a1.time).getTime());
        actions = actions.slice(0, 5);
        for (const action of actions) {
            const div = `<div class="action_div object_div" onclick="window.open('${action.url}','blank');"><p class="action_text object_text"><strong>(${action.time}) ${action.action}</strong></br> ${action.repoName}</p></div>`
            actionsHTML += div;
        }
        actionsTd.innerHTML = actionsHTML;
    }

    /**
     * Finds the element referenced by the given XPath in the document
     * @param {String} xPath XPath reference to node
     */
    static getElementByXpath(xPath: any) {
        return document.evaluate(xPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }
}