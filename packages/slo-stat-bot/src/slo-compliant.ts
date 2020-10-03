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
import {ProbotOctokit} from 'probot';
import moment from 'moment';
import {SLORules, IssuesListCommentsItem, IssueItem} from './types';
import {convertToArray} from './slo-appliesTo';
import {logger} from 'gcf-utils';

interface IssueAssignees {
  login: string;
}

interface ReposListCollaboratorsItem {
  login: string;
  permissions: {
    pull: boolean;
    push: boolean;
    admin: boolean;
  };
}

/**
 * Function gets the file contents
 * @param github unique installation id for each function
 * @param owner of issue or pr
 * @param repo of issue or pr
 * @param path of the file
 * @returns string of the content in the file
 */
export const getFilePathContent = async function getFilePathContent(
  github: InstanceType<typeof ProbotOctokit>,
  owner: string,
  repo: string,
  path: string
): Promise<string | null> {
  try {
    const fileResponse = await github.repos.getContents({
      owner,
      repo,
      path,
    });
    const data = fileResponse.data as {content?: string};
    const content = Buffer.from(data.content as string, 'base64').toString(
      'utf8'
    );
    return content;
  } catch (err) {
    logger.info(
      `Could not retrieve file content for path ${path} in repo ${repo} \n ${err.message}`
    );
    return null;
  }
};

/**
 * Function checks if a valid responder commented on issue within response time
 * @param github of issue or pr
 * @param issueItem is an object that has issue owner, repo, number, type, created time of issue, assignees, labels, and comments
 * @param responders that are valid for issue or pr
 * @param responseTime of issue or pr
 * @returns true if valid responder responded in time else false
 */
export const isInResponseTime = async function isInResponseTime(
  github: InstanceType<typeof ProbotOctokit>,
  issueItem: IssueItem,
  responders: Set<string>,
  responseTime: string | number
): Promise<boolean> {
  const isInResTime = await isInDuration(responseTime, issueItem.createdAt);

  if (!isInResTime) {
    //If the comment from the webhook event is a valid responder returns true
    if (issueItem.comment && responders.has(issueItem.comment.user.login)) {
      return true;
    }

    //If either the comment is undefined or not from a valid responder, checks the list of comments on the issue for a valid responder
    const listIssueComments = await getIssueCommentsList(
      github,
      issueItem.owner,
      issueItem.repo,
      issueItem.number
    );

    //API calls that fail to get list of issue comments will return true but log the error
    if (!listIssueComments) {
      return true;
    }

    for (const comment of listIssueComments) {
      if (responders.has(comment.user.login)) {
        return true;
      }
    }
  }

  return isInResTime;
};

/**
 * Function checks if a valid responder is assigned to the issue
 * @param responders that are valid for issue or pr
 * @param assignees of issue or pr
 * @returns true if valid responder was assigned the issue
 */
export const isAssigned = async function isAssigned(
  responders: Set<string>,
  assignees: IssueAssignees[]
): Promise<boolean> {
  for (const assignee of assignees) {
    if (responders.has(assignee.login)) {
      return true;
    }
  }
  return false;
};

/**
 * Function gets list of issue comments
 * @param github github unique installation id for each function
 * @param owner of issue or pr
 * @param repo of issue or pr
 * @param number of issue or pr
 * @returns an array of IssuesListCommentsItem with id number, user login, updated time, and created time
 */
export const getIssueCommentsList = async function getIssueCommentsList(
  github: InstanceType<typeof ProbotOctokit>,
  owner: string,
  repo: string,
  number: number
): Promise<IssuesListCommentsItem[] | null> {
  try {
    const listComments = await github.issues.listComments({
      owner,
      repo,
      issue_number: number,
    });
    return listComments.data;
  } catch (err) {
    logger.error(
      `Error in getting issue comments for number ${number}\n ${err.message}`
    );
    return null;
  }
};

/**
 * Function gets list of valid responders from the owners (uri-reference of code owners), contributers (defaults to WRITE), and array of users
 * @param github github unique installation id for each function
 * @param owner of issue or pr
 * @param repo of issue or pr
 * @param slo rule
 * @returns a set of valid responders
 */
export const getResponders = async function getResponders(
  github: InstanceType<typeof ProbotOctokit>,
  owner: string,
  repo: string,
  slo: SLORules
): Promise<Set<string>> {
  let responders: Set<string> = new Set([owner]);

  const owners = convertToArray(slo.complianceSettings.responders?.owners);
  if (owners) {
    for (const ownerPath of owners) {
      const content = await getFilePathContent(github, owner, repo, ownerPath);
      const users = content?.match(/@([^\s]+)/g);

      users?.forEach(user => {
        if (user.length > 1) responders.add(user.substr(1));
      });
    }
  }

  let contributors = slo.complianceSettings.responders?.contributors;
  if (!slo.complianceSettings.responders) {
    contributors = 'WRITE';
  }
  if (contributors) {
    const collaborators = await getCollaborators(github, owner, repo);
    responders = await getContributers(
      owner,
      responders,
      contributors,
      collaborators
    );
  }

  const users = slo.complianceSettings.responders?.users;
  users?.forEach(user => responders.add(user));

  return responders;
};

/**
 * Function gets contributers depending on write, admin, and owner permissions
 * @param owner of issue or pr
 * @param responders that are valid
 * @param contributors either 'WRITE', 'ADMIN', or 'OWNER'
 * @param collaborators of ReposListCollaboratorsItems that specifies user login, and their permissions (pull, push, admin)
 * @returns set of valid responders usernames
 */
export const getContributers = async function getContributers(
  owner: string,
  responders: Set<string>,
  contributors: string,
  collaborators: ReposListCollaboratorsItem[] | null
): Promise<Set<string>> {
  responders.add(owner);

  if (contributors === 'OWNER') {
    return responders;
  }

  if (collaborators) {
    for (const collab of collaborators) {
      if (
        (contributors === 'WRITE' &&
          collab.permissions.pull &&
          collab.permissions.push) ||
        collab.permissions.admin
      ) {
        responders.add(collab.login);
      } else if (contributors === 'ADMIN' && collab.permissions.admin) {
        responders.add(collab.login);
      }
    }
  }
  return responders;
};

/**
 * Function gets list of collaborators on the repo
 * @param github unique installation id for each function
 * @param owner of issue or pr
 * @param repo of issue or pr
 * @returns of ReposListCollaboratorsItems that specifies user login, and their permissions (pull, push, admin)
 */
export const getCollaborators = async function getCollaborators(
  github: InstanceType<typeof ProbotOctokit>,
  owner: string,
  repo: string
): Promise<ReposListCollaboratorsItem[] | null> {
  try {
    const collaboratorList = await github.repos.listCollaborators({
      owner,
      repo,
    });
    return collaboratorList.data;
  } catch (err) {
    logger.warn(`Error in getting list of collaborators \n ${err.message}`);
    return null;
  }
};

/**
 * Function determines if difference between start and end time is within the duration time of the slo
 * Defaults to seconds if no unit specified
 * @param duration rule defined in slo either in: days(d), hours(h), minutes(m), seconds(s)
 * @param startTime of issue or pr
 * @param endTime of issue or pr. If end time is missing gets the current time
 * @returns true if it is in duration else false
 */
export const isInDuration = async function isInDuration(
  duration: string | number,
  startTime: string,
  endTime?: string
): Promise<boolean> {
  const start = moment(startTime);
  const end = endTime ? moment(endTime) : moment();
  let unit = '';
  let diff: number;

  if (typeof duration === 'string') {
    unit = duration.charAt(duration.length - 1);
    duration = Number(duration.substr(0, duration.length - 1));
  }
  if (unit === 'd') {
    diff = moment.duration(end.diff(start)).asDays();
  } else if (unit === 'h') {
    diff = moment.duration(end.diff(start)).asHours();
  } else if (unit === 'm') {
    diff = moment.duration(end.diff(start)).asMinutes();
  } else {
    diff = moment.duration(end.diff(start)).asSeconds();
  }

  return diff <= duration;
};

/**
 * Function checks if issue is compliant with slo
 * @param github unique installation id for each function
 * @param issueItem is an object that has issue owner, repo, number, type, created time of issue, assignees, labels, and comments
 * @param slo rule
 * @returns true if issue is compliant with slo else false
 */
export const isIssueCompliant = async function isIssueCompliant(
  github: InstanceType<typeof ProbotOctokit>,
  issueItem: IssueItem,
  slo: SLORules
): Promise<boolean> {
  const sloString = JSON.stringify(slo, null, 4);

  const resTime = slo.complianceSettings.resolutionTime;
  if (resTime !== 0) {
    const result = await isInDuration(resTime, issueItem.createdAt);
    if (!result) {
      logger.info(
        `Issue ${issueItem.number} in repo ${issueItem.repo} is not compliant for slo: \n ${sloString} \n Reason: It is not in resolution time`
      );
      return false;
    }
  }

  const responders = await getResponders(
    github,
    issueItem.owner,
    issueItem.repo,
    slo
  );

  const reqAssignee = slo.complianceSettings.requiresAssignee;
  if (reqAssignee === true) {
    const result = await isAssigned(responders, issueItem.assignees);
    if (!result) {
      logger.info(
        `Issue ${issueItem.number} in repo ${issueItem.repo} is not compliant for slo: \n ${sloString} \n Reason: Does not have a valid assignee`
      );
      return false;
    }
  }

  const responseTime = slo.complianceSettings.responseTime;
  if (responseTime !== 0) {
    const result = await isInResponseTime(
      github,
      issueItem,
      responders,
      responseTime
    );
    if (!result) {
      logger.info(
        `Issue ${issueItem.number} in repo ${issueItem.repo} is not compliant for slo: \n ${sloString} \n Reason: No valid responder commented within response time`
      );
      return false;
    }
  }
  return true;
};
