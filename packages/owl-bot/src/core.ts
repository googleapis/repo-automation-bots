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
import {exec} from 'child_process';
import {promisify} from 'util';
const execAsync = promisify(exec);
import {load} from 'js-yaml';
import {logger} from 'gcf-utils';
import {sign} from 'jsonwebtoken';
import {request} from 'gaxios';
import {CloudBuildClient} from '@google-cloud/cloudbuild';
import {Octokit} from '@octokit/rest';
// eslint-disable-next-line node/no-extraneous-import
import {OwlBotLock, owlBotLockPath, owlBotLockFrom} from './config-files';
import {OctokitType} from './octokit-util';

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

export async function triggerPostProcessBuild(
  args: BuildArgs,
  octokit?: OctokitType
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
  for (let i = 0; i < 60; i++) {
    const [build] = await client.getBuild({projectId, id});
    if (build.status !== 'WORKING' && build.status !== 'QUEUED') {
      return build;
    }
    // Wait a few seconds before checking the build status again:
    await new Promise(resolve => {
      setTimeout(() => {
        return resolve(undefined);
      }, 10000);
    });
  }
  throw Error(`timed out waiting for build ${id}`);
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

export async function createCheck(args: CheckArgs, octokit?: OctokitType) {
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
export async function getOwlBotLock(
  repoFull: string,
  pullNumber: number,
  octokit: OctokitType
): Promise<OwlBotLock | undefined> {
  const [owner, repo] = repoFull.split('/');
  const {data: prData} = await octokit.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
  });
  const configString = await getFileContent(
    owner,
    repo,
    owlBotLockPath,
    prData.head.ref,
    octokit
  );
  if (configString === undefined) {
    logger.warn(`no .OwlBot.lock.yaml found in ${repoFull}`);
    return configString;
  }
  const maybeOwlBotLock = load(configString);
  if (maybeOwlBotLock === null || typeof maybeOwlBotLock !== 'object') {
    throw Error('lock file did not parse as object');
  }
  return owlBotLockFrom(maybeOwlBotLock);
}

/**
 * Octokit makes it surprisingly difficult to fetch the content for a file.
 * This function makes it easier.
 * @param owner the github org or user; ex: "googleapis"
 * @param repo the rep name; ex: "nodejs-vision"
 * @param path the file path within the repo; ex: ".github/.OwlBot.lock.yaml"
 * @param ref the commit hash
 * @param {OctokitType} octokit - authenticated instance of Octokit.
 */
export async function getFileContent(
  owner: string,
  repo: string,
  path: string,
  ref: string,
  octokit: OctokitType
): Promise<string | undefined> {
  try {
    const data = (
      await octokit.repos.getContent({
        owner,
        repo,
        path,
        ref,
      })
    ).data as {content: string | undefined; encoding: string};
    if (!data.content) {
      return undefined;
    }
    if (data.encoding !== 'base64') {
      throw Error(`unexpected encoding ${data.encoding} in ${owner}/${repo}`);
    }
    const text = Buffer.from(data.content, 'base64').toString('utf8');
    return text;
  } catch (err) {
    if (err.status === 404) return undefined;
    else throw err;
  }
}

/**
 * Given a git repository and sha, returns the files modified by the
 * given commit.
 * @param path path to git repository on disk.
 * @param sha commit to list modified files for.
 * @returns a list of file paths.
 */
export async function getFilesModifiedBySha(
  path: string,
  sha: string
): Promise<string[]> {
  // --no-renames to avoid
  // warning: inexact rename detection was skipped due to too many files.
  const out = await execAsync(`git show --name-only --no-renames ${sha}`, {
    cwd: path,
    // Handle 100,000+ files changing:
    maxBuffer: 1024 * 1024 * 512,
  });
  if (out.stderr) throw Error(out.stderr);
  const filesRaw = out.stdout.trim();
  const files = [];
  // We walk the output in reverse, since the file list is shown at the end
  // of git show:
  for (const file of filesRaw.split(/\r?\n/).reverse()) {
    // There will be a blank line between the commit message and the
    // files list, we use this as a stopping point:
    if (file === '') break;
    files.push(file);
  }
  return files;
}

/**
 * Returns an iterator that returns the most recent commits added to a repository.
 * @param repoFull org/repo
 * @param octokit authenticated octokit instance.
 */
export async function* commitsIterator(
  repoFull: string,
  octokit: OctokitType,
  per_page = 25
) {
  const [owner, repo] = repoFull.split('/');
  for await (const response of octokit.paginate.iterator(
    octokit.repos.listCommits,
    {
      owner,
      repo,
      per_page,
    }
  )) {
    for (const commit of response.data) {
      yield commit.sha;
    }
  }
}

const OWLBOT_USER = 'gcf-owl-bot[bot]';
/*
 * Detect whether there's an update loop created by OwlBot post-processor.
 *
 * @param owner owner of repo.
 * @param repo short repo name.
 * @param prNumber PR to check for loop.
 * @param octokit authenticated instance of octokit.
 */
async function hasOwlBotLoop(
  owner: string,
  repo: string,
  prNumber: number,
  octokit: Octokit
): Promise<boolean> {
  // If N (where N=circuitBreaker) commits are added to a pull-request
  // by the post-processor one after another, this indicates that we're
  // potentially looping, e.g., flip flopping a date between 2020 and 2021.
  //
  // It's okay to have 2 commits from Owl-Bot in a row, e.g., a commit for
  // a code update plus the post processor.
  //
  // It's also okay to run the post-processor many more than circuitBreaker
  // times on a long lived PR, with human edits being made.
  const circuitBreaker = 3;
  const commits = (
    await octokit.pulls.listCommits({
      pull_number: prNumber,
      owner,
      repo,
    })
  ).data;
  let count = 0;
  for (const commit of commits) {
    if (commit?.author?.login === OWLBOT_USER) count++;
    else count = 0;
    if (count >= circuitBreaker) return true;
  }
  return false;
}

export const core = {
  commitsIterator,
  createCheck,
  getAccessTokenURL,
  getAuthenticatedOctokit,
  getCloudBuildInstance,
  getFilesModifiedBySha,
  getFileContent,
  getGitHubShortLivedAccessToken,
  getOwlBotLock,
  hasOwlBotLoop,
  owlBotLockPath,
  triggerPostProcessBuild,
};
