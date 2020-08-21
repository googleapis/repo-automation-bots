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

import {ActionInfo} from '../query-data/processed-data-cache';

export class Render {
  static executionsByBot(executionCounts: {[botName: string]: number}) {
    const rowId = 'stat_executions_by_bot';
    const row = document.getElementById(rowId) as HTMLTableRowElement;
    row.innerHTML = '';
    const cell = row.insertCell(-1);
    let cellHTML = '';
    for (const botName of Object.keys(executionCounts)) {
      cellHTML += this.buildNumericalStatComponent(
        botName,
        String(executionCounts[botName])
      );
    }
    cell.innerHTML = cellHTML;
  }

  static tasksByBot(taskCount: {[botName: string]: number}) {
    const rowId = 'stat_tasks_by_bot';
    const row = document.getElementById(rowId) as HTMLTableRowElement;
    row.innerHTML = '';
    const cell = row.insertCell(-1);
    let cellHTML = '';
    for (const botName of Object.keys(taskCount)) {
      cellHTML += this.buildNumericalStatComponent(
        botName,
        String(taskCount[botName])
      );
    }
    cell.innerHTML = cellHTML;
  }

  /**
   * Renders the given errors
   * @param {msg: string, botName: string, logsUrl: string, time: string} errors errors to render
   */
  public static errors(errors: any) {
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

  public static actions(actions: ActionInfo[]) {
    const xPath = '//tr[@id="stat_actions"]/td';
    const actionsTd = this.getElementByXpath(xPath) as HTMLElement;
    let actionsHTML = '';
    if (actions.length === 0) {
      actionsHTML = this.buildActionObjectDiv('No Actions', '', '#');
    } else {
      actions = this.getMostRecent(5, actions);
      for (const action of actions) {
        actionsHTML += this.buildActionObjectDiv(
          `(${action.time}) ${action.description}`,
          action.description,
          action.url
        );
      }
    }
    actionsTd.innerHTML = actionsHTML;
  }

  private static getMostRecent(count: number, actions: ActionInfo[]) {
    actions.sort(
      (a1: any, a2: any) =>
        new Date(a2.time).getTime() - new Date(a1.time).getTime()
    );
    return actions.slice(0, count);
  }

  private static buildActionObjectDiv(
    strongText: string,
    bodyText: string,
    url: string
  ): string {
    return this.buildObjectDiv(
      strongText,
      bodyText,
      url,
      ['action_text', 'object_text'],
      ['action_div', 'object_div']
    );
  }

  private static buildObjectDiv(
    strongText: string,
    bodyText: string,
    url: string,
    textClasses: string[],
    divClasses: string[]
  ): string {
    const textClassesString = textClasses.join(' ');
    const innerP = `<p class="${textClassesString}"><strong>${strongText}</strong></br>${bodyText}</p>`;
    const onClick = `onclick="window.open('${url}','blank');"`;
    return `<div class="${divClasses.join(' ')}" ${onClick}>${innerP}</div>`;
  }

  /**
   * Returns the HTML components (as a string) for a numerical stat
   * @param label the label for the stat
   * @param value the value of the stat
   */
  private static buildNumericalStatComponent(
    label: string,
    value: string
  ): string {
    const statP = `<p class="stat" id="${label}">${value}</p>`;
    const labelP = `<p class="label" id="${label}">${label}</p>`;
    return `<div class="data_div">${statP}${labelP}</div>`;
  }

  /**
   * Finds the element referenced by the given XPath in the document
   * @param {String} xPath XPath reference to node
   */
  private static getElementByXpath(xPath: any) {
    return document.evaluate(
      xPath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    ).singleNodeValue;
  }
}
