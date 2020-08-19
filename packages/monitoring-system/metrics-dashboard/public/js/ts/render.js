"use strict";
exports.__esModule = true;
exports.Render = void 0;
var Render = /** @class */ (function () {
    function Render() {
    }
    /**
     * Adds the labels for the given bots
     * @param {Array<string>} botNames names of bots to add labels for
     */
    Render.addBotNameLabels = function (botNames) {
        for (var _i = 0, _a = this.statRowsByBot; _i < _a.length; _i++) {
            var rowId = _a[_i];
            var row = document.getElementById(rowId);
            row.innerHTML = "";
            var cell = row.insertCell(-1);
            var cellHTML = '';
            for (var _b = 0, botNames_1 = botNames; _b < botNames_1.length; _b++) {
                var name_1 = botNames_1[_b];
                cellHTML += "<div class=\"data_div\"><p class=\"stat\" id=\"" + name_1 + "\">0</p><p class=\"label\" id=\"" + name_1 + "\">" + name_1 + "</p></div>";
            }
            cell.innerHTML = cellHTML;
        }
    };
    Render.addTriggerTypeLabels = function (triggerTypes) {
        for (var _i = 0, _a = this.statRowsByTrigger; _i < _a.length; _i++) {
            var rowId = _a[_i];
            var row = document.getElementById(rowId);
            row.innerHTML = "";
            for (var _b = 0, triggerTypes_1 = triggerTypes; _b < triggerTypes_1.length; _b++) {
                var type = triggerTypes_1[_b];
                var labelCell = row.insertCell(-1);
                labelCell.innerHTML = "<p class=\"stat\" id=\"" + type + "\">-</p><p class=\"label\" id=\"" + type + "\">" + type + "</p>";
            }
        }
    };
    /**
     * Renders the execution counts for given bots
     * @param {[bot_name: string]: number} executionCounts a map of bot_name to execution counts
     */
    Render.executionsByBot = function (executionCounts) {
        for (var _i = 0, _a = Object.keys(executionCounts); _i < _a.length; _i++) {
            var botName = _a[_i];
            var xPath = "//tr[@id=\"stat_executions_by_bot\"]//p[contains(@class, \"stat\") and @id=\"" + botName + "\"]";
            var statP = this.getElementByXpath(xPath);
            statP.innerHTML = String(executionCounts[botName]);
        }
    };
    // TODO JSDoc
    Render.executionsByTrigger = function (executionCounts) {
        var types = Object.keys(executionCounts);
        this.addTriggerTypeLabels(types); // TODO: optimize instead of rewriting labels each time
        for (var _i = 0, types_1 = types; _i < types_1.length; _i++) {
            var type = types_1[_i];
            var xPath = "//tr[@id=\"stat_executions_by_trigger\"]//p[contains(@class, \"stat\") and @id=\"" + type + "\"]";
            var statP = this.getElementByXpath(xPath);
            statP.innerHTML = String(executionCounts[type]);
        }
    };
    // TODO JSDoc
    Render.tasksByBot = function (taskCount) {
        for (var _i = 0, _a = Object.keys(taskCount); _i < _a.length; _i++) {
            var botName = _a[_i];
            var xPath = "//tr[@id=\"stat_tasks_by_bot\"]//p[contains(@class, \"stat\") and @id=\"" + botName + "\"]";
            var statP = this.getElementByXpath(xPath);
            statP.innerHTML = String(taskCount[botName]);
        }
    };
    /**
     * Renders the given errors
     * @param {msg: string, botName: string, logsUrl: string, time: string} errors errors to render
     */
    Render.errors = function (errors) {
        var xPath = "//tr[@id=\"stat_errors\"]/td";
        var errorsTd = this.getElementByXpath(xPath);
        var errorsHTML = '';
        errors.sort(function (e1, e2) { return new Date(e2.time).getTime() - new Date(e1.time).getTime(); });
        errors = errors.slice(0, 5);
        for (var _i = 0, errors_1 = errors; _i < errors_1.length; _i++) {
            var error = errors_1[_i];
            var div = "<div class=\"error_div object_div\" onclick=\"window.open('" + error.logsUrl + "','blank');\"><p class=\"error_text object_text\"><strong>(" + error.time + ") " + error.botName + ":</strong></br> " + error.msg + "</p></div>";
            errorsHTML += div;
        }
        errorsTd.innerHTML = errorsHTML;
    };
    /**
     * Renders the given actions
     * @param {repoName: string, url: string, action: string, time: string} actions actions to render
     */
    Render.actions = function (actions) {
        var xPath = "//tr[@id=\"stat_actions\"]/td";
        var actionsTd = this.getElementByXpath(xPath);
        var actionsHTML = '';
        actions.sort(function (a1, a2) { return new Date(a2.time).getTime() - new Date(a1.time).getTime(); });
        actions = actions.slice(0, 5);
        for (var _i = 0, actions_1 = actions; _i < actions_1.length; _i++) {
            var action = actions_1[_i];
            var div = "<div class=\"action_div object_div\" onclick=\"window.open('" + action.url + "','blank');\"><p class=\"action_text object_text\"><strong>(" + action.time + ") " + action.action + "</strong></br> " + action.repoName + "</p></div>";
            actionsHTML += div;
        }
        actionsTd.innerHTML = actionsHTML;
    };
    /**
     * Finds the element referenced by the given XPath in the document
     * @param {String} xPath XPath reference to node
     */
    Render.getElementByXpath = function (xPath) {
        return document.evaluate(xPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    };
    /**
     * Rows that contain statistics 'By Bot' and need bot names
     * as labels underneath stats
     */
    Render.statRowsByBot = [
        'stat_executions_by_bot',
        'stat_tasks_by_bot',
    ];
    /**
     * Rows that contain statistics 'By Trigger' and need trigger types
     * as labels underneath stats
     */
    Render.statRowsByTrigger = [
        'stat_executions_by_trigger'
    ];
    return Render;
}());
exports.Render = Render;
