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

import {GitHubAPI} from 'probot';
import moment from 'moment';

interface SLOStatus {
  appliesTo: boolean;
  isCompliant: boolean | null;
}

enum Priority {
  'P0',
  'P1',
  'P2',
  'P3',
  'P4',
  'P5',
}

interface SLORules {
  appliesTo: {
    gitHubLabels?: string | string[];
    excludedGitHubLabels?: string | string[];
    priority?: Priority;
    issueType?: string;
    issues?: boolean;
    prs?: boolean;
  };
  complianceSettings: {
    responseTime: string | number;
    resolutionTime: string | number;
    requiresAssignee?: boolean;
    responders?: {
      owners?: string | string[];
      contributors?: string;
      users?: string[];
    };
  };
}

interface IssueAssignees {
  login: string;
}

interface IssuesListCommentsItem {
  id: number;
  user: {
    login: string;
  };
  created_at: string;
  updated_at: string;
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
 * Function gets list of files changed on the pr
 * @param type specifies if event is issue or pr
 * @param slo rules
 * @param issueLabels of issue or pr
 * @returns true if slo applies to issue else false
 */
export const doesSloApply = async function doesSloApply(
  type: string,
  slo: SLORules,
  issueLabels: string[] | null
): Promise<boolean> {
  if (Object.keys(slo.appliesTo).length === 0) {
    return true;
  }

  if (issueLabels === null || issueLabels.length === 0) {
    return false;
  }

  const appliesToIssues = slo.appliesTo.issues;
  const appliesToPrs = slo.appliesTo.prs;
  const appliesToType = await isValidIssue(
    appliesToIssues,
    appliesToPrs,
    type
  );
  if (!appliesToType) {
    return false;
  }

  const githubLabels = slo.appliesTo.gitHubLabels;
  const hasGithubLabels = await isValidGithubLabels(
    issueLabels,
    githubLabels
  );
  if (!hasGithubLabels) {
    return false;
  }

  const excludedGitHubLabels = slo.appliesTo.excludedGitHubLabels;
  const hasNoExLabels = await isValidExcludedLabels(
    issueLabels,
    excludedGitHubLabels
  );
  if (!hasNoExLabels) {
    return false;
  }

  const priority = String(slo.appliesTo.priority);
  const hasPriority = await isValidRule(
    issueLabels,
    priority,
    'priority: '
  );
  if (!hasPriority) {
    return false;
  }

  const issueType = slo.appliesTo.issueType;
  const hasIssueType = await isValidRule(
    issueLabels,
    issueType,
    'type: '
  );
  if (!hasIssueType) {
    return false;
  }

  return true;
};

/**
 * Function determines if the type of issue applies to slo
 * @param issues slo rule if it applies to issues
 * @param prs slo rule if it applies to prs
 * @param type specifies if event is issue or pr
 * @returns true if type applies to issues else false
 */
export const isValidIssue = async function isValidIssue(
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
  if (!isSubSet) {
    return false;
  }
  return true;
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

  excludedGitHubLabels = await convertToArray(
    excludedGitHubLabels
  );
  excludedGitHubLabels.forEach((label: string) => label.toLowerCase());
  const isElementExist = excludedGitHubLabels.some((label: string) =>
    issueLabels.includes(label)
  );
  if (isElementExist) {
    return false;
  }
  return true;
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
  return issueLabels.includes(rule) || issueLabels.includes(title + rule);
};

/**
 * Function converts a string variable to an array
 * @param variable can either be array or string
 * @returns an array
 */
async function convertToArray(
  variable: string[] | string
): Promise<string[]> {
  if (typeof variable === 'string') {
    return [variable];
  }
  return variable;
};

/**
 * Function gets the file contents
 * @param github unique installation id for each function
 * @param owner of issue or pr
 * @param repo of issue or pr
 * @param path of the file
 * @returns string of the content in the file
 */
export const getFilePathContent = async function getFilePathContent(
  github: GitHubAPI,
  owner: string,
  repo: string,
  path: string
): Promise<string> {
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
    return 'not found';
  }
};

/**
 * Function checks if issue is compliant with slo
 * @param github unique installation id for each function
 * @param owner of issue or pr
 * @param repo of issue or pr
 * @param issueNumber of the issue or pr
 * @param assignees of the issue or pr
 * @param issueUpdateTime of the issue or pr
 * @param slo rule
 * @returns true if issue is compliant with slo else false
 */
export const isIssueCompliant = async function isIssueCompliant(
  github: GitHubAPI,
  owner: string,
  repo: string,
  issueNumber: number,
  assignees: IssueAssignees[],
  issueUpdateTime: string,
  slo: SLORules
): Promise<boolean> {
  const resTime = slo.complianceSettings.resolutionTime;
  if (resTime !== 0) {
    const result = await isInDuration(
      resTime,
      issueUpdateTime
    );
    if (!result) {
      console.log(`Not in resolutions time for issue ${issueNumber} in repo ${repo}`);
      return false;
    }
  }

  const responders = await getResponders(github, owner, repo, slo);

  const reqAssignee = slo.complianceSettings.requiresAssignee;
  if (reqAssignee === true) {
    const result = await isAssigned(responders, assignees);
    if (!result) {
      console.log(`Does not have valid assignee for issue ${issueNumber} in repo ${repo}`);
      return false;
    }
  }

  const responseTime = slo.complianceSettings.responseTime;
  if (responseTime !== 0) {
    const result = await isInResponseTime(
      github,
      owner,
      repo,
      issueNumber,
      responders,
      responseTime,
      issueUpdateTime
    );
    if (!result) {
      console.log(`Not in response time for issue ${issueNumber} in repo ${repo}`);
      return false;
    }
  }
  return true;
};

/**
 * Function checks if a valid responder commented on issue within response time
 * @param github 
 * @param owner
 * @param repo
 * @param issueNumber
 * @param responders that are valid for issue or pr
 * @param responseTime of issue or pr
 * @param issueCreatedTime of the issue or pr
 * @returns true if valid responder responded in time else false
 */
export const isInResponseTime = async function isInResponseTime(
  github: GitHubAPI,
  owner: string,
  repo: string,
  issueNumber: number,
  responders: Set<string>,
  responseTime: string | number,
  issueCreatedTime: string
): Promise<boolean> {

  const isInResTime =  await isInDuration(responseTime, issueCreatedTime);

  if(!isInResTime) {
    const listIssueComments = await getIssueCommentsList(
      github,
      owner,
      repo,
      issueNumber
    );

    //API calls that fail to get list of issue comments will return true but log the error
    if(!listIssueComments) {
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
 * @param issueNumber of issue or pr
 * @returns an array of IssuesListCommentsItem with id number, user login, updated time, and created time
 */
export const getIssueCommentsList = async function getIssueCommentsList(
  github: GitHubAPI,
  owner: string,
  repo: string,
  issueNumber: number
): Promise<IssuesListCommentsItem[] | null> {
  try {
    const listComments = await github.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
    });
    return listComments.data;
  } catch (err) {
    console.error(
      `Error in getting issue comments for number ${issueNumber}\n ${err.request}`
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
  github: GitHubAPI,
  owner: string,
  repo: string,
  slo: SLORules
): Promise<Set<string>> {
  let responders: Set<string> = new Set([owner]);

  let owners = slo.complianceSettings.responders?.owners;
  if (owners) {
    owners = await convertToArray(owners);
    for (const ownerPath of owners) {
      const content = await getFilePathContent(
        github,
        owner,
        repo,
        ownerPath
      );
      const users = content.match(/@([^\s]+)/g);

      users?.forEach(user => {
        if (user.length > 1) responders.add(user.substr(1));
      });
    }
  }

  let contributors = slo.complianceSettings.responders?.contributors;
  if (!slo.complianceSettings.responders) {
    contributors = 'WRITE';
  }
  if(contributors) {
    const collaborators = await getCollaborators(
      github,
      owner,
      repo
    );
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
  github: GitHubAPI,
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
    console.warn(`Error in getting list of collaborators \n ${err.request}`);
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
 * Function gets the slo status
 * @param github unique installation id for each function
 * @param owner of issue or pr
 * @param repo of issue or pr
 * @param issueCreatedTime of the issue or pr
 * @param assignees of the issue or pr
 * @param issueNumber of the issue or pr
 * @param slo rule
 * @param labels on issue or pr
 * @returns the slo status if slo applies to issue and if it is complaint with issue (if issue does not apply isCompliant is set to null)
 */
export async function getSloStatus(
  github: GitHubAPI,
  owner: string,
  repo: string,
  issueCreatedTime: string,
  assignees: IssueAssignees[],
  issueNumber: number,
  type: string,
  slo: SLORules,
  labels: string[] | null
): Promise<SLOStatus> {
  const appliesTo = await doesSloApply(type, slo, labels);
  let isCompliant = null;

  if (appliesTo) {
    isCompliant = await isIssueCompliant(
      github,
      owner,
      repo,
      issueNumber,
      assignees,
      issueCreatedTime,
      slo
    );
  }

  return {
    appliesTo: appliesTo,
    isCompliant: isCompliant,
  } as SLOStatus;
}
