// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// eslint-disable-next-line node/no-extraneous-import
import {SLORules} from './types';

/**
 * Function determines if the type of issue applies to slo
 * @param issues slo rule if it applies to issues
 * @param prs slo rule if it applies to prs
 * @param type specifies if event is issue or pr
 * @returns true if type applies to issues else false
 */
export const isValidType = async function isValidType(
  issues: boolean | undefined,
  prs: boolean | undefined,
  type: string
): Promise<boolean> {
  issues = issues === undefined ? true : issues;
  prs = prs === undefined ? false : prs;

  if (type === 'pull_request' && prs) {
    return true;
  }
  if (type === 'issue' && issues) {
    return true;
  }
  return false;
};

/**
 * Function checks if all the githublabels are subset of issue labels
 * @param issueLabels of the issue
 * @param githubLabels is slo rule for github labels that must exist in issue
 * @returns true if githubLabels applies to issues else false
 */
export const isValidGithubLabels = async function isValidGithubLabels(
  issueLabels: string[],
  githubLabels: string | string[] | undefined
): Promise<boolean> {
  if (!githubLabels) {
    return true;
  }

  githubLabels = await convertToArray(githubLabels);
  githubLabels.forEach((label: string) => label.toLowerCase());
  const isSubSet = githubLabels.every((label: string) =>
    issueLabels.includes(label)
  );
  return isSubSet;
};

/**
 * Function checks if all the excluded github labels is not in issue labels
 * @param issueLabels of the issue
 * @param excludedGitHubLabels is slo rule for excluded github labels that must exist in issue
 * @returns true if excludedGitHubLabels applies to issues else false
 */
export const isValidExcludedLabels = async function isValidExcludedLabels(
  issueLabels: string[],
  excludedGitHubLabels: string | string[] | undefined
): Promise<boolean> {
  if (!excludedGitHubLabels) {
    return true;
  }

  excludedGitHubLabels = await convertToArray(excludedGitHubLabels);
  excludedGitHubLabels.forEach((label: string) => label.toLowerCase());
  const isElementExist = excludedGitHubLabels.some((label: string) =>
    issueLabels.includes(label)
  );
  return !isElementExist;
};

/**
 * Function checks if the rule (priority or type) exists in issue labels
 * @param issueLabels of the issue
 * @param rule is either priority or type (ex: bug, enhancement) of issue
 * @param title of the rule
 * @returns true if rule applies to issue else false
 */
export const isValidRule = async function isValidRule(
  issueLabels: string[],
  rule: string | undefined,
  title: string
) {
  if (!rule) {
    return true;
  }

  rule = rule.toLowerCase();

  if (issueLabels.includes(rule)) {
    return true;
  }
  if (issueLabels.includes(title + rule)) {
    return true;
  }
  return false;
};

/**
 * Function converts the variable to an array if it is a string
 * @param variable can either be array or string
 * @returns an array
 */
export const convertToArray = async function convertToArray(
  variable: string[] | string
): Promise<string[]> {
  if (typeof variable === 'string') {
    return [variable];
  }
  return variable;
};

/**
 * Function determines if slo applies to the issue
 * @param type specifies if event is issue or pr
 * @param slo rules
 * @param issueLabels of issue or pr
 * @param number of issue or pr
 * @returns true if slo applies to issue else false
 */
export const doesSloApply = async function doesSloApply(
  type: string,
  slo: SLORules,
  issueLabels: string[] | null,
  number: number
): Promise<boolean> {
  const sloString = JSON.stringify(slo, null, 4);

  if (Object.keys(slo.appliesTo).length === 0) {
    return true;
  }

  if (issueLabels === null) {
    console.info(
      `Skipping issue ${number} for rule ${sloString} \n as it does not apply`
    );
    return false;
  }

  if (issueLabels.length === 0) {
    console.info(
      `Skipping issue ${number} for rule ${sloString} \n as it does not apply`
    );
    return false;
  }

  const appliesToIssues = slo.appliesTo.issues;
  const appliesToPrs = slo.appliesTo.prs;
  const appliesToType = await isValidType(appliesToIssues, appliesToPrs, type);
  if (!appliesToType) {
    console.info(
      `Skipping issue ${number} for rule ${sloString} \n as it does not apply to type`
    );
    return false;
  }

  const githubLabels = slo.appliesTo.gitHubLabels;
  const hasGithubLabels = await isValidGithubLabels(issueLabels, githubLabels);
  if (!hasGithubLabels) {
    console.info(`
    Skipping issue ${number} for rule ${sloString} \n as it does not apply to gitHubLabels`);
    return false;
  }

  const excludedGitHubLabels = slo.appliesTo.excludedGitHubLabels;
  const hasNoExLabels = await isValidExcludedLabels(
    issueLabels,
    excludedGitHubLabels
  );
  if (!hasNoExLabels) {
    console.info(
      `Skipping issue ${number} for rule ${sloString} \n as it does not apply to excludedGitHubLabels`
    );
    return false;
  }

  const priority = String(slo.appliesTo.priority);
  const hasPriority = await isValidRule(issueLabels, priority, 'priority: ');
  if (!hasPriority) {
    console.info(
      `Skipping issue ${number} for rule ${sloString} \n as it does not apply to priority`
    );
    return false;
  }

  const issueType = slo.appliesTo.issueType;
  const hasIssueType = await isValidRule(issueLabels, issueType, 'type: ');
  if (!hasIssueType) {
    console.info(
      `Skipping issue ${number} for rule ${sloString} \n as it does not apply to issue type`
    );
    return false;
  }

  return true;
};
