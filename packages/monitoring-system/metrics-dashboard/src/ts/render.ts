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

import * as d3 from 'd3';

export class Render {

    /**
     * Rows that contain statistics 'By Bot' and need bot names
     * as labels underneath stats
     */
    static statRowsByBot = [
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

    static addTriggerTypeLabels(triggerTypes: any) {
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
        const rowId = "stat_executions_by_bot";
        const row = document.getElementById(rowId) as HTMLTableRowElement;
        row.innerHTML = "";
        const cell = row.insertCell(-1);
        let cellHTML = '';
        for (const botName of Object.keys(executionCounts)) {
            cellHTML += `<div class="data_div"><p class="stat" id="${botName}">${String(executionCounts[botName])}</p><p class="label" id="${botName}">${botName}</p></div>`;
        }
        cell.innerHTML = cellHTML;
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
        this.addBotNameLabels(Object.keys(taskCount))
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

    static taskQueueTrend(data) {
        var width = 300;
        var height = 300;
        const div = d3.select('#tasks_by_time')
        const margin = { top: 50, right: 50, bottom: 90, left: 75 }
        const maxY = data.map(d => d.y).reduce((a, b) => Math.max(a, b));
        
        const svg = div.append('svg')
            .attr('width', width + margin.left + margin.right)
          .attr('height', height + margin.top + margin.bottom)
          .append('g')
          .attr('transform', `translate(${margin.left}, ${margin.top})`)
        
        /*
         * X and Y scales.
         */
        const xScale = d3.scaleLinear()
            .domain([0, data.length - 1])
          .range([0, width])
        
        const yScale = d3.scaleLinear()
                .domain([0, maxY])
            .range([height, 0])
        
        /*
         * The function that describes how the line is drawn.
         * Notice that we apply the xScale and yScale to the
         * data in order to keep the data in bounds to our scale.
         */
        const line: any = d3.line()
            .x((d: any) => xScale(d.x))
          .y((d: any) => yScale(d.y))
          .curve(d3['curveMonotoneX'])
        
        /*
         * X and Y axis
         */
        const xAxis = svg.append('g')
            .attr('class', 'x axis')
          .attr('transform', `translate(0, ${height})`)
          .call(d3.axisBottom(xScale))
        
        const yAxis = svg.append('g')
            .attr('class', 'y axis')
          .call(d3.axisLeft(yScale))
        
        /*
         * Appending the line to the SVG.
         */
        svg.append('path')
        .datum(data)
        .attr('class', 'data-line')
        .attr('d', line)
    }

    /**
     * Finds the element referenced by the given XPath in the document
     * @param {String} xPath XPath reference to node
     */
    static getElementByXpath(xPath: any) {
        return document.evaluate(xPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    }
}