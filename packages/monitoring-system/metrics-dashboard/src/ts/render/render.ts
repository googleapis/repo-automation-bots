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

export class Render {

  /**
   * Renders the execution counts for given bots
   * @param {[bot_name: string]: number} executionCounts a map of bot_name to execution counts
   */
  static executionsByBot(executionCounts: any) {
    const rowId = 'stat_executions_by_bot';
    const row = document.getElementById(rowId) as HTMLTableRowElement;
    row.innerHTML = '';
    const cell = row.insertCell(-1);
    let cellHTML = '';
    for (const botName of Object.keys(executionCounts)) {
      cellHTML += `<div class="data_div"><p class="stat" id="${botName}">${String(
        executionCounts[botName]
      )}</p><p class="label" id="${botName}">${botName}</p></div>`;
    }
    cell.innerHTML = cellHTML;
  }

  // TODO JSDoc
  static tasksByBot(taskCount: any) {
    const rowId = "stat_tasks_by_bot";
    const row = document.getElementById(rowId) as HTMLTableRowElement;
    row.innerHTML = '';
    const cell = row.insertCell(-1);
    let cellHTML = '';
    for (const botName of Object.keys(taskCount)) {
      cellHTML += `<div class="data_div"><p class="stat" id="${botName}">${taskCount[botName]}</p><p class="label" id="${botName}">${botName}</p></div>`;
    }
    cell.innerHTML = cellHTML;
  }

  /**
   * Renders the given errors
   * @param {msg: string, botName: string, logsUrl: string, time: string} errors errors to render
   */
  static errors(errors: any) {
    const xPath = '//tr[@id="stat_errors"]/td';
    const errorsTd = this.getElementByXpath(xPath) as HTMLElement;
    let errorsHTML = '';
    if (errors.length === 0) {
      errorsHTML =
        '<div class="error_div object_div"><p class="error_text object_text"><strong>No Errors</p></div>';
    } else {
      errors.sort(
        (e1: any, e2: any) =>
          new Date(e2.time).getTime() - new Date(e1.time).getTime()
      );
      errors = errors.slice(0, 5);
      for (const error of errors) {
        const div = `<div class="error_div object_div" onclick="window.open('${error.logsUrl}','blank');"><p class="error_text object_text"><strong>(${error.time}) ${error.botName}:</strong></br> ${error.msg}</p></div>`;
        errorsHTML += div;
      }
    }
    errorsTd.innerHTML = errorsHTML;
  }

  /**
   * Renders the given actions
   * @param {repoName: string, url: string, action: string, time: string} actions actions to render
   */
  static actions(actions: any) {
    const xPath = '//tr[@id="stat_actions"]/td';
    const actionsTd = this.getElementByXpath(xPath) as HTMLElement;
    let actionsHTML = '';
    if (actions.length === 0) {
      actionsHTML =
        '<div class="action_div object_div"><p class="action_text object_text"><strong>No Actions</strong></p></div>';
    } else {
      actions.sort(
        (a1: any, a2: any) =>
          new Date(a2.time).getTime() - new Date(a1.time).getTime()
      );
      actions = actions.slice(0, 5);
      for (const action of actions) {
        const div = `<div class="action_div object_div" onclick="window.open('${action.url}','blank');"><p class="action_text object_text"><strong>(${action.time}) ${action.actionDescription}</strong></br> ${action.repoName}</p></div>`;
        actionsHTML += div;
      }
    }
    actionsTd.innerHTML = actionsHTML;
  }

  /**
   * Finds the element referenced by the given XPath in the document
   * @param {String} xPath XPath reference to node
   */
  static getElementByXpath(xPath: any) {
    return document.evaluate(
      xPath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;
  }
}
