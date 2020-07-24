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
import {logger} from 'gcf-utils';

/**
 * Function converts the variable to an array if it is a string
 * @param variable can either be array or string
 * @returns an array
 */
export const convertToArray = async function convertToArray(
  variable?: string[] | string
): Promise<string[] | undefined> {
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

  // Checking if the type of issue applies to the prs or issues
  const issues =
    slo.appliesTo.issues === undefined ? true : slo.appliesTo.issues;
  const prs = slo.appliesTo.prs === undefined ? false : slo.appliesTo.prs;

  if ((type === 'pull_request' && !prs) || (type === 'issue' && !issues)) {
    logger.info(
      `Skipping issue ${number} for rule ${sloString} \n as it does not apply to the given type ${type}`
    );
    return false;
  }

  //Checking if all the githublabels are subset of issue labels
  const githubLabels = await convertToArray(slo.appliesTo.gitHubLabels);

  const isSubSet = githubLabels?.every((label: string) =>
    issueLabels?.includes(label)
  );

  if (!isSubSet && githubLabels) {
    logger.info(`
    Skipping issue ${number} for rule ${sloString} \n as it does not apply to gitHubLabels`);
    return false;
  }

  //Checking that no excludedlabel is in issue labels
  const excludedGitHubLabels = await convertToArray(
    slo.appliesTo.excludedGitHubLabels
  );

  const isElementExist = excludedGitHubLabels?.some((label: string) => {
    issueLabels?.includes(label);
  });

  if (isElementExist && excludedGitHubLabels) {
    logger.info(
      `Skipping issue ${number} for rule ${sloString} \n as it does not apply to excludedGitHubLabels`
    );
    return false;
  }

  return true;
};
