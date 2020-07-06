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

import {Application, Context} from 'probot';
import {GitHubAPI} from 'probot/lib/github';
import Ajv, {ErrorObject} from 'ajv';
import moment from 'moment';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const schema = require('./../data/schema.json');

type Conclusion =
  | 'success'
  | 'failure'
  | 'neutral'
  | 'cancelled'
  | 'timed_out'
  | 'action_required'
  | undefined;

interface ValidationResults {
  isValid: boolean;
  errors?: ErrorObject[] | null;
}

interface PullsListFilesResponseItem {
  filename: string;
  sha: string;
}

interface IssueLabelResponseItem {
  name: string;
}

interface IssueAssignees {
  login: string;
}

interface IssuesListCommentsResponse {
  id: number;
  user: {
    login: string;
  };
  created_at: string;
  updated_at: string;
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
    issues: boolean;
    prs: boolean;
  };
  complianceSettings: {
    responseTime: string | number;
    resolutionTime: string | number;
    requiresAssignee: boolean;
    responders?: {
      owners?: string | string[];
      contributors?: string;
      users?: string[];
    };
  };
}

function handler(app: Application) {
  app.on(
    [
      'pull_request.opened',
      'pull_request.reopened',
      'pull_request.edited',
      'pull_request.synchronize',
    ],
    async (context: Context) => {
      const owner = context.payload.repository.owner.login;
      const repo = context.payload.repository.name;
      const pull_number = context.payload.number;

      const fileList = await handler.listFiles(
        context.github,
        owner,
        repo,
        pull_number,
        100
      );

      if (fileList === null) {
        return;
      }

      for (const file of fileList) {
        //Checks to see if file is repo level or org level issue_slo_rules.json
        if (
          file.filename === '.github/issue_slo_rules.json' ||
          (repo === '.github' && file.filename === 'issue_slo_rules.json')
        ) {
          await handler.handle_slos(
            context,
            owner,
            repo,
            pull_number,
            file.sha
          );
          break;
        }
      }
    }
  );
  app.on(['issues.closed'], 
    async (context: Context) => {
      const owner = context.payload.repository.owner.login;
      const repo = context.payload.repository.name;
      const issue_number = context.payload.issue.number;
      const labelsResponse = context.payload.issue.labels;

      const labels: string[] = [];
      labelsResponse.forEach((label: IssueLabelResponseItem) =>
        labels.push(label.name.toLowerCase())
      );

      if(labels?.includes("ooslo")){
        await handler.removeIssueLabel(context.github, owner, repo, issue_number);
     }
    }
  );
  app.on(
    [
      'issues.opened',
      'issues.reopened',
      'issues.labeled',
      'issues.edited',
      'issues.assigned',
      'issues.unassigned',
    ],
    async (context: Context) => {
      const owner = context.payload.repository.owner.login;
      const repo = context.payload.repository.name;
      const labelsResponse = context.payload.issue.labels;

      const labels: string[] = [];
      labelsResponse.forEach((label: IssueLabelResponseItem) =>
        labels.push(label.name.toLowerCase())
      );

      const sloString = await handler.getSloFile(context.github, owner, repo);
      await handler.handle_issues(
        context,
        owner,
        repo,
        sloString,
        labels
      );
    }
  );
}

// Checking to see if issue applies to any slo in list then checking compiliancy
handler.handle_issues = async function handle_issues(
  context: Context,
  owner: string,
  repo: string,
  sloString: string,
  labels: string[] | null,
) {
  const sloList = JSON.parse(sloString);

  for (const slo of sloList) {
    let appliesTo: boolean = Object.keys(slo.appliesTo).length === 0;
    if (!appliesTo) {
      appliesTo = await handler.appliesTo(slo, labels);
    }
  
    if (appliesTo) {
      // Checking compliancy setting if slo applies to issue
      const issueCreatedTime = context.payload.issue.created_at; //Or due_on ??
      const assignees: IssueAssignees[] = context.payload.issue.assignees;
      const issue_number = context.payload.issue.number;
      const isCompliant =  await handler.complianceSettings(
        context.github,
        owner,
        repo,
        issue_number,
        assignees,
        issueCreatedTime,
        slo
      );
      console.log(isCompliant);
      if(!isCompliant && !labels?.includes("ooslo")) {
        const isLabelExist = handler.checkExistingLabel(context.github, owner, repo);
        if(!isLabelExist) {
          await handler.createLabel(context.github, owner, repo);
        }
        await this.addLabel(context.github, owner, repo, issue_number);
      } else if(isCompliant && labels?.includes("ooslo")){
         await handler.removeIssueLabel(context.github, owner, repo, issue_number);
      }
    }
  }
};

// Lints issue_slo_rules.json file and creates a check on PR. If file is invalid it will comment on PR
handler.handle_slos = async function handle_slos(
  context: Context,
  owner: string,
  repo: string,
  issue_number: number,
  file_sha: string
) {
  const sloString = await handler.getFileShaContents(
    context.github,
    owner,
    repo,
    file_sha
  );

  if (sloString === null) {
    return;
  }

  const sloData = JSON.parse(sloString);
  const res = await handler.lint(schema, sloData);

  await handler.commentPR(
    context.github,
    owner,
    repo,
    issue_number,
    res.isValid
  );
  await handler.createCheck(context, res);
};

handler.getFileShaContents = async function getFileShaContents(
  github: GitHubAPI,
  owner: string,
  repo: string,
  file_sha: string
): Promise<string | null> {
  try {
    const blob = await github.git.getBlob({
      owner,
      repo,
      file_sha,
    });
    const fileContent = Buffer.from(blob.data.content, 'base64').toString(
      'utf8'
    );
    return fileContent;
  } catch (err) {
    console.warn(
      `Error getting file content in repo:${repo}. error status:${err.status}`
    );
    return null;
  }
};

handler.listFiles = async function listFiles(
  github: GitHubAPI,
  owner: string,
  repo: string,
  pull_number: number,
  per_page: number
): Promise<PullsListFilesResponseItem[] | null> {
  try {
    const listOfFiles = await github.pulls.listFiles({
      owner,
      repo,
      pull_number,
      per_page,
    });
    return listOfFiles.data;
  } catch (err) {
    console.warn(
      `Error getting list of files in repo: ${repo} for issue number: ${pull_number}. error status:${err.status}`
    );
    return null;
  }
};

//Linting the issue_slo_rules.json against the slo schema
handler.lint = async function lint(
  schema: JSON,
  sloData: JSON
): Promise<ValidationResults> {
  const ajv = new Ajv();
  const validate = await ajv.compile(schema);
  const isValid = await validate(sloData);

  return {
    isValid: isValid,
    errors: validate.errors,
  } as ValidationResults;
};

//Comments on PR only if the issue_slo_rules.json is invalid
handler.commentPR = async function commentPR(
  github: GitHubAPI,
  owner: string,
  repo: string,
  issue_number: number,
  isValid: boolean
) {
  if (isValid) {
    return;
  }
  const body =
    'ERROR: "issue_slo_rules.json" file is not valid with JSON schema';
  try {
    await github.issues.createComment({
      owner,
      repo,
      issue_number,
      body,
    });
  } catch (err) {
    console.warn(
      `Error creating comment in repo: ${repo} for issue number: ${issue_number}. error status: ${err.status}`
    );
    return;
  }
};

handler.createCheck = async function createCheck(
  context: Context,
  validationRes: ValidationResults
) {
  let checkParams = context.repo({
    name: 'slo-rules-check',
    head_sha: context.payload.pull_request.head.sha,
    conclusion: 'success' as Conclusion,
  });

  if (!validationRes.isValid) {
    checkParams = context.repo({
      name: 'slo-rules-check',
      head_sha: context.payload.pull_request.head.sha,
      conclusion: 'failure' as Conclusion,
      output: {
        title: 'Commit message did not follow Conventional Commits',
        summary: 'issue_slo_rules.json does not follow the slo_rules schema.',
        text: JSON.stringify(validationRes.errors, null, 4),
      },
    });
  }
  try {
    await context.github.checks.create(checkParams);
  } catch (err) {
    console.error(
      `Error creating check in repo ${context.payload.repository.name} \n ${err}`
    );
    return;
  }
};

//Checking if slo applies to a given issue
handler.appliesTo = async function appliesTo(
  slo: SLORules,
  issueLabels: string[] | null
): Promise<boolean> {
  if (issueLabels === null || issueLabels.length === 0) {
    return false;
  }

  const githubLabels = slo.appliesTo.gitHubLabels;
  const validGithubLabels = await handler.validGithubLabels(
    issueLabels,
    githubLabels
  );
  if (!validGithubLabels) {
    return false;
  }

  const excludedGitHubLabels = slo.appliesTo.excludedGitHubLabels;
  const validExcludeLabels = await handler.validExcludedLabels(
    issueLabels,
    excludedGitHubLabels
  );
  if (!validExcludeLabels) {
    return false;
  }

  const priority = String(slo.appliesTo.priority);
  const validPriority = await handler.isValid(
    issueLabels,
    priority,
    'priority: '
  );
  if (!validPriority) {
    return false;
  }

  const issueType = slo.appliesTo.issueType;
  const validIssueType = await handler.isValid(
    issueLabels,
    issueType,
    'type: '
  );
  if (!validIssueType) {
    return false;
  }

  return true;
};

handler.validGithubLabels = async function validGithubLabels(
  issueLabels: string[],
  githubLabels: string | string[] | undefined
): Promise<boolean> {
  if (!githubLabels) {
    return true;
  }

  githubLabels = await handler.convertToArray(githubLabels);
  githubLabels.forEach((label: string) => label.toLowerCase());
  const isSubSet = githubLabels.every((label: string) =>
    issueLabels.includes(label)
  );
  if (!isSubSet) {
    return false;
  }
  return true;
};

handler.validExcludedLabels = async function validExcludedLabels(
  issueLabels: string[],
  excludedGitHubLabels: string | string[] | undefined
): Promise<boolean> {
  if (!excludedGitHubLabels) {
    return true;
  }

  excludedGitHubLabels = await handler.convertToArray(excludedGitHubLabels);
  excludedGitHubLabels.forEach((label: string) => label.toLowerCase());
  const isElementExist = excludedGitHubLabels.some((label: string) =>
    issueLabels.includes(label)
  );
  if (isElementExist) {
    return false;
  }
  return true;
};

handler.isValid = async function isValid(
  issueLabels: string[],
  rule: string | undefined,
  title: string
) {
  if (!rule) {
    return true;
  }

  rule = rule.toLowerCase();
  const includes =
    issueLabels.includes(rule) || issueLabels.includes(title + rule);
  if (!includes) {
    return false;
  }
  return true;
};

handler.convertToArray = async function convertToArray(
  variable: string[] | string
): Promise<string[]> {
  if (typeof variable === 'string') {
    return [variable];
  }
  return variable;
};

// If the repo level config file does not exists defaults to org config file
handler.getSloFile = async function getSloFile(
  github: GitHubAPI,
  owner: string,
  repo: string
): Promise<string> {
  let path = '.github/issue_slo_rules.json';
  let sloRules: string = await handler.getFilePathContent(
    github,
    owner,
    repo,
    path
  );
  if (sloRules === 'not found') {
    path = 'issue_slo_rules.json';
    sloRules = await handler.getFilePathContent(github, owner, '.github', path);
  }
  return sloRules;
};

handler.getFilePathContent = async function getFilePathContent(
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
    // console.log(fileResponse.data);
    const data = fileResponse.data as {content?: string};
    const content = Buffer.from(data.content as string, 'base64').toString(
      'utf8'
    );

    return content;
  } catch (err) {
    if (repo === '.github') {
      //Error if org level does not exist
      throw `Error in finding org level config file in ${owner} \n ${err}`;
    }
    return 'not found';
  }
};

//Method will be used for cloud scheduler
handler.getListOfIssueLabels = async function getListOfIssueLabels(
  github: GitHubAPI,
  owner: string,
  repo: string,
  issue_number: number
): Promise<string[] | null> {
  try {
    const labelsResponse = await github.issues.listLabelsOnIssue({
      owner,
      repo,
      issue_number,
    });

    const labels: string[] = [];
    labelsResponse.data.forEach(label => labels.push(label.name.toLowerCase()));
    return labels;
  } catch (err) {
    console.error(`Error in retrieving issue labels in repo ${repo} \n ${err}`);
    return null;
  }
};

handler.complianceSettings = async function complianceSettings(
  github: GitHubAPI,
  owner: string,
  repo: string,
  issue_number: number,
  assignees: IssueAssignees[],
  issueUpdateTime: string,
  slo: SLORules
): Promise<boolean> {

  //Checking if issue is resolved within resolution time
  const resTime = slo.complianceSettings.resolutionTime;
  if (resTime !== 0) {
    const isInResTime = await handler.isInDuration(resTime, issueUpdateTime);
    // console.log("Resolution Time?");
    // console.log(isInResTime);
    if (!isInResTime) {
      return false;
    }
  }
  //Only used when response time != 0 or assignee is true
  const responders: Set<string> = await handler.getResponders(
    github,
    owner,
    repo,
    slo
  ); // CHECK FOR FAILURE RESPONDERS

  //Checking if issue is assigned if slo claims it must have assignee
  const reqAssignee = slo.complianceSettings.requiresAssignee;
  if (reqAssignee === true) {
    const isAssigned = await handler.isAssigned(responders, assignees);
    // console.log("Requires Assignee?");
    // console.log(isAssigned);
    if (!isAssigned) {
      return false;
    }
  }

  //Checking if issue is responded within response time
  const responseTime = slo.complianceSettings.responseTime; //Get comments
  if (responseTime !== 0) {
    const listIssueComments = await handler.getIssueCommentsList(
      github,
      owner,
      repo,
      issue_number
    );
    const isInResponseTime = await handler.isInResponseTime(
      responders,
      listIssueComments,
      slo.complianceSettings.responseTime,
      issueUpdateTime
    );
    // console.log("Response Time?: ");
    // console.log(isInResponseTime);
    if (!isInResponseTime) {
      return false;
    }
  }

  return true;
};

handler.isInResponseTime = async function isInResponseTime(
  responders: Set<string>,
  listIssueComments: IssuesListCommentsResponse[] | null,
  resolutionTime: string | number,
  issueCreatedTime: string
): Promise<boolean> {
  if(!listIssueComments) {
    return true;//If API call to list issue comments failed, does not attempt to label the issue
  } //HANDLE PAGINATION
  for (const comment of listIssueComments) {
    if (responders.has(comment.user.login)) {
      const isValidTime = await handler.isInDuration(
        resolutionTime,
        issueCreatedTime,
        comment.created_at,
      );
      if (isValidTime) {
        return true;
      }
    }
  }
  return false;
};

handler.isAssigned = async function isAssigned(
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

handler.getIssueCommentsList = async function getIssueCommentsList(
  github: GitHubAPI,
  owner: string,
  repo: string,
  issue_number: number
): Promise<IssuesListCommentsResponse[] | null> {
  try {
    const listComments = await github.issues.listComments({
      owner,
      repo,
      issue_number,
    });
    return listComments.data;
  } catch (err) {
    console.error(
      `Error in getting issue comments for number ${issue_number}\n ${err.request}`
    );
    return null;
  }
};

handler.getResponders = async function getResponders(
  github: GitHubAPI,
  owner: string,
  repo: string,
  slo: SLORules
): Promise<Set<string>> {
  const responders: Set<string> = new Set();

  const owners = slo.complianceSettings.responders?.owners;
  if (owners) {
    const ownersArr = await handler.convertToArray(owners);
    for (const ownerPath of ownersArr) {
      const content = await handler.getFilePathContent(
        github,
        owner,
        repo,
        ownerPath
      );
      const usersArr = content.match(/@([^\s]+)/g);
      if(usersArr) {
        usersArr.forEach(user => {if(user.length > 1) responders.add(user.substr(1))});
      }
    }
  }

  const contributors = slo.complianceSettings.responders?.contributors;
  if (contributors) {
    await handler.addContributers(
      github,
      owner,
      repo,
      responders,
      contributors
    );
  }
  const users = slo.complianceSettings.responders?.users;
  if (users) {
    users.forEach(user => responders.add(user));
  }
  return responders;
};

handler.addContributers = async function addContributers(
  github: GitHubAPI,
  owner: string,
  repo: string,
  responders: Set<string>,
  contributors: string
) {
  const collaboratorList = await handler.getCollaborators(github, owner, repo);
  if (collaboratorList) {
    if (contributors === 'OWNER') {
      responders.add(owner);
      return;
    }

    for (const collab of collaboratorList) {
      if (
        (contributors === 'WRITE' &&
          collab.permissions.pull &&
          collab.permissions.push) ||
          collab.permissions.admin ||
          collab.login === owner
      ) {
        responders.add(collab.login);
      } else if (
        (contributors === 'ADMIN' && collab.permissions.admin) ||
        collab.login === owner
      ) {
        responders.add(collab.login);
      } 
    }
  }
};

handler.getCollaborators = async function getCollaborators(
  github: GitHubAPI,
  owner: string,
  repo: string
) {
  //Add a return type
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

handler.isInDuration = async function isInDuration(
  duration: string | number,
  startTime: string,
  endTime?: string,
): Promise<boolean> {
  const start = moment(startTime);
  const end = endTime ? moment(endTime) : moment();
  let unit = '';
  let diff: number;

  if (typeof duration === 'string') {
    unit = duration.charAt(duration.length - 1);
    duration = Number(
      duration.substr(0, duration.length - 1)
    );
  }

  if (unit === 'd') {
    diff = moment.duration(end.diff(start)).asDays();
  } else if (unit === 'h') {
    diff = moment.duration(end.diff(start)).asHours();
  } else if (unit === 'm') {
    diff = moment.duration(end.diff(start)).asMinutes();
  } else {
    //assume seconds
    diff = moment.duration(end.diff(start)).asSeconds();
  }

  return diff <= duration;
};

handler.checkExistingLabel = async function checkExistingLabel (
  github: GitHubAPI,
  owner: string,
  repo: string,
): Promise<boolean | null> {
  try {
    const  name = "OOSLO";
    const label = await github.issues.getLabel({
      owner,
      repo,
      name,
    });
    return label.data.name == "OOSLO";
  } catch (err) {
    console.warn(`Error in checking to see if repo ${repo} has OOSLO label`);
    return null;
  }
}

handler.createLabel =  async function createLabel (
  github: GitHubAPI,
  owner: string,
  repo: string
) {
  try {
    const  name = "OOSLO";
    const color = "#FF0000";
    const description = "Issue is out of slo";
    const label = await github.issues.createLabel({
      owner,
      repo,
      name,
      color,
      description
    });
 
  } catch (err) {
    console.error(`Error when creating OOSLO label for repo ${repo} \n ${err.request}`);
  }
}

handler.addLabel = async function addLabel (
  github: GitHubAPI,
  owner: string,
  repo: string,
  issueNumber: number
) {
  try {
    const labels = ["OOSLO"];
    const data = await github.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels,
    });
  } catch (err) {
    console.error(`Error adding OOSLO label in repo ${repo} for issue number ${issueNumber}\n ${err.request}`);
  }
}

handler.removeIssueLabel = async function removeIssueLabel(
  github: GitHubAPI,
  owner: string,
  repo: string,
  issueNumber: number
) {
  try {
    const name = "OOSLO";
    await github.issues.removeLabel({
      owner,
      repo,
      issue_number: issueNumber,
      name,
    });

  } catch (err) {
    console.error(`Error removing OOSLO label in repo ${repo} for issue number ${issueNumber}\n ${err.request}`);
  }
}

export = handler;
