// Copyright 2021 Google LLC
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
import {load} from 'js-yaml';
import {sign} from 'jsonwebtoken';
import {request} from 'gaxios';
import {CloudBuildClient} from '@google-cloud/cloudbuild';
import {Octokit} from '@octokit/rest';
// eslint-disable-next-line node/no-extraneous-import
import {ProbotOctokit} from 'probot';

type OctokitType =
  | InstanceType<typeof Octokit>
  | InstanceType<typeof ProbotOctokit>;

type YAMLParseResponse = string | number | object | null | undefined;

interface BuildArgs {
  image: string;
  privateKey: string;
  appId: number;
  installation: number;
  repo: string;
  pr: number;
  project?: string;
  trigger: string;
}

export interface CheckArgs {
  privateKey: string;
  appId: number;
  installation: number;
  pr: number;
  repo: string;
  summary: string;
  conclusion: 'success' | 'failure';
  text: string;
  title: string;
}

interface AuthArgs {
  privateKey: string;
  appId: number;
  installation: number;
}

interface BuildResponse {
  conclusion: 'success' | 'failure';
  summary: string;
  text: string;
}

interface Commit {
  sha: string;
}

interface Token {
  token: string;
  expires_at: string;
  permissions: object;
  repository_selection: string;
}

// The .github/.OwlBot.lock.yaml is stored on each repository that OwlBot
// is configured for, and indicates the docker container that should be run
// for post processing:
export interface OwlBotLock {
  docker: {
    image: string;
    digest: string;
  };
}

export async function triggerBuild(
  args: BuildArgs,
  octokit?: OctokitType,
  logger = console
): Promise<BuildResponse> {
  const token = await core.getGitHubShortLivedAccessToken(
    args.privateKey,
    args.appId,
    args.installation
  );
  const project = args.project || process.env.PROJECT_ID;
  if (!project) {
    throw Error('gcloud project must be provided');
  }
  const cb = core.getCloudBuildInstance();
  const [owner, repo] = args.repo.split('/');
  if (!octokit) {
    octokit = await core.getAuthenticatedOctokit(token.token);
  }
  const {data: prData} = await octokit.pulls.get({
    owner,
    repo,
    pull_number: args.pr,
  });
  const [prOwner, prRepo] = prData.head.repo.full_name.split('/');
  const [resp] = await cb.runBuildTrigger({
    projectId: project,
    triggerId: args.trigger,
    source: {
      projectId: project,
      branchName: 'master',
      substitutions: {
        _GITHUB_TOKEN: token.token,
        _PR: args.pr.toString(),
        _PR_BRANCH: prData.head.ref,
        _PR_OWNER: prOwner,
        _REPOSITORY: prRepo,
        // _CONTAINER must contain the image digest. For example:
        // gcr.io/repo-automation-tools/nodejs-post-processor**@1234abcd**
        // TODO: read this from OwlBot.yaml.
        _CONTAINER: args.image,
      },
    },
  });
  try {
    // TODO(bcoe): work with fenster@ to figure out why awaiting a long
    // running operation does not behave as expected:
    // const [build] = await resp.promise();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buildId: string = (resp as any).metadata.build.id;
    const build = await waitForBuild(project, buildId, cb);
    if (!build.steps) throw Error('trigger contained no steps');
    const successMessage = `successfully ran ${build.steps.length} steps 🎉!`;
    let conclusion: 'success' | 'failure' = 'success';
    let summary = successMessage;
    let text = '';
    let failures = 0;
    for (const step of build.steps) {
      if (step.status !== 'SUCCESS') {
        conclusion = 'failure';
        summary = `${++failures} steps failed 🙁`;
        text += `❌ step ${step.name} failed with status ${step.status}\n`;
      }
    }
    if (conclusion === 'success') {
      text = `successfully ran ${build.steps.length} steps 🎉!`;
    }
    return {
      conclusion,
      summary,
      text,
    };
  } catch (err) {
    logger.error(err);
    return {
      conclusion: 'failure',
      summary: 'unknown build failure',
      text: 'unknown build failure',
    };
  }
}

async function waitForBuild(
  projectId: string,
  id: string,
  client: CloudBuildClient
) {
  for (let i = 0; i < 120; i++) {
    const [build] = await client.getBuild({projectId, id});
    if (build.status !== 'WORKING' && build.status !== 'QUEUED') {
      return build;
    }
    // Wait a few seconds before checking the build status again:
    await new Promise(resolve => {
      setTimeout(() => {
        return resolve(undefined);
      }, 5000);
    });
  }
  throw Error(`timed out waiting for buuild ${id}`);
}

export async function getHeadCommit(
  owner: string,
  repo: string,
  pr: number,
  octokit: OctokitType
): Promise<Commit | undefined> {
  // If a PR has more than 100 updates to it, we will currently have issues
  // in practice this should be rare:
  const {data: commits} = await octokit.pulls.listCommits({
    owner,
    repo,
    pull_number: pr,
    per_page: 100,
  });
  const headCommit = commits[commits.length - 1];
  if (!headCommit) return;
  else return headCommit as Commit;
}

export async function createCheck(
  args: CheckArgs,
  octokit?: OctokitType,
  logger = console
) {
  if (!octokit) {
    octokit = await core.getAuthenticatedOctokit({
      privateKey: args.privateKey,
      appId: args.appId,
      installation: args.installation,
    });
  }
  const [owner, repo] = args.repo.split('/');
  const headCommit = await getHeadCommit(owner, repo, Number(args.pr), octokit);
  if (!headCommit) {
    logger.warn(`no commit found for PR ${args.pr}`);
    return;
  }
  await octokit.checks.create({
    owner,
    repo,
    name: 'OwlBot Post Processor',
    summary: args.summary,
    head_sha: headCommit.sha as string,
    conclusion: args.conclusion,
    output: {
      title: args.title,
      summary: args.summary,
      text: args.text,
    },
  });
}

export async function getGitHubShortLivedAccessToken(
  privateKey: string,
  appId: number,
  installation: number
): Promise<Token> {
  const payload = {
    // issued at time
    // Note: upstream API seems to fail if decimals are included
    // in unixtime, this is why parseInt is run:
    iat: parseInt('' + Date.now() / 1000),
    // JWT expiration time (10 minute maximum)
    exp: parseInt('' + Date.now() / 1000 + 10 * 60),
    // GitHub App's identifier
    iss: appId,
  };
  const jwt = sign(payload, privateKey, {algorithm: 'RS256'});
  const resp = await request<Token>({
    url: getAccessTokenURL(installation),
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (resp.status !== 201) {
    throw Error(`unexpected response http = ${resp.status}`);
  } else {
    return resp.data;
  }
}

export function getAccessTokenURL(installation: number) {
  return `https://api.github.com/app/installations/${installation}/access_tokens`;
}

let cachedOctokit: OctokitType;
export async function getAuthenticatedOctokit(
  auth: string | AuthArgs,
  cache = true
): Promise<OctokitType> {
  if (cache && cachedOctokit) return cachedOctokit;
  let tokenString: string;
  if (auth instanceof Object) {
    const token = await getGitHubShortLivedAccessToken(
      auth.privateKey,
      auth.appId,
      auth.installation
    );
    tokenString = token.token;
  } else {
    tokenString = auth;
  }
  const octokit = new Octokit({
    auth: tokenString,
  });
  if (cache) cachedOctokit = octokit;
  return octokit;
}

function getCloudBuildInstance() {
  return new CloudBuildClient();
}

/*
 * Load OwlBot lock file from .github/.OwlBot.lock.yaml.
 * TODO(bcoe): abstract into common helper that supports .yml.
 *
 * @param {string} repoFull - repo in org/repo format.
 * @param {number} pullNumber - pull request to base branch on.
 * @param {OctokitType} octokit - authenticated instance of Octokit.
 */
const owlBotLockPath = '.github/.OwlBot.lock.yaml';
export async function getOwlBotLock(
  repoFull: string,
  pullNumber: number,
  octokit: OctokitType
): Promise<OwlBotLock> {
  const [owner, repo] = repoFull.split('/');
  const {data: prData} = await octokit.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
  });
  const configRaw = (
    await octokit.repos.getContent({
      owner,
      repo,
      path: owlBotLockPath,
      ref: prData.head.ref,
    })
  ).data as {content: string | undefined; encoding: string};
  if (!configRaw.content) {
    throw Error(`unable to find ${owlBotLockPath} in ${repoFull}`);
  }
  if (configRaw.encoding !== 'base64') {
    throw Error(`unexpected encoding ${configRaw.encoding} in ${repoFull}`);
  }
  const configString = Buffer.from(configRaw.content, 'base64').toString(
    'utf8'
  );
  const maybeOwlBotLock = load(configString);
  if (assertIsOwlBotLock(maybeOwlBotLock)) {
    return maybeOwlBotLock;
  } else {
    throw Error(`invalid config ${owlBotLockPath} in ${repoFull}`);
  }
}

/*
 * Given a JavaScript object, asserts that it contains the appropriate keys
 * for .OwlBot.lock.yaml.
 *
 * @param {object} maybeOwlBotLock - object to validate.
 */
function assertIsOwlBotLock(
  maybeOwlBotLock: YAMLParseResponse
): maybeOwlBotLock is OwlBotLock {
  if (typeof maybeOwlBotLock !== 'object') {
    throw Error('lock file did not parse as object');
  }
  const owlBotLock = maybeOwlBotLock as OwlBotLock;
  if (typeof owlBotLock.docker !== 'object') {
    throw Error('lock file did not contain "docker" key');
  }
  if (typeof owlBotLock.docker.image !== 'string') {
    throw Error('docker.image was not a string');
  }
  if (typeof owlBotLock.docker.digest !== 'string') {
    throw Error('docker.digest was not a string');
  }
  return true;
}

export const core = {
  createCheck,
  getAccessTokenURL,
  getAuthenticatedOctokit,
  getCloudBuildInstance,
  getGitHubShortLivedAccessToken,
  getOwlBotLock,
  owlBotLockPath,
  triggerBuild,
};
