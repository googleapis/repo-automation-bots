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
import {RequestError} from '@octokit/types';
// eslint-disable-next-line node/no-extraneous-import
import {
  OwlBotLock,
  OWL_BOT_LOCK_PATH,
  owlBotLockFrom,
  DEFAULT_OWL_BOT_YAML_PATH,
} from './config-files';
import {OctokitFactory, OctokitType} from './octokit-util';
import {OWL_BOT_IGNORE} from './labels';
import {
  findCopyTag,
  findSourceHash,
  sourceLinkFrom,
  sourceLinkLineFrom,
  unpackCopyTag,
} from './copy-code';
import {google} from '@google-cloud/cloudbuild/build/protos/protos';
import {v4 as uuidv4} from 'uuid';

interface BuildArgs {
  image: string;
  privateKey: string;
  appId: number;
  installation: number;
  repo: string;
  pr: number;
  project?: string;
  trigger: string;
  defaultBranch?: string;
}

export interface CheckArgs {
  privateKey: string;
  appId: number;
  installation: number;
  pr: number;
  repo: string;
  summary: string;
  conclusion: 'success' | 'failure';
  detailsURL: string;
  text: string;
  title: string;
}

interface AuthArgs {
  privateKey: string;
  appId: number;
  installation: number;
}

interface BuildSummary {
  conclusion: 'success' | 'failure';
  summary: string;
  text: string;
}

interface BuildResponse extends BuildSummary {
  detailsURL: string;
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

export const OWL_BOT_LOCK_UPDATE = 'owl-bot-update-lock';
export const OWL_BOT_COPY = 'owl-bot-copy';

function projectIdFromArgs(args: {project?: string}): string {
  const project = args.project || process.env.PROJECT_ID;
  if (!project) {
    throw Error('gcloud project must be provided');
  }
  return project;
}

export async function triggerIsolatedPostProcessBuild(
  args: BuildArgs,
  octokit?: OctokitType
): Promise<BuildResponse | null> {
  const project = projectIdFromArgs(args);
  const [owner, repo] = args.repo.split('/');
  if (!octokit) {
    octokit = await core.getAuthenticatedOctokit(args);
  }
  const {data: prData} = await octokit.pulls.get({
    owner,
    repo,
    pull_number: args.pr,
  });

  // See if someone asked owl bot to ignore this PR.
  if (prData.labels.find(label => label.name === OWL_BOT_IGNORE)) {
    logger.info(
      `Ignoring ${owner}/${repo} #${args.pr} because it's labeled with ${OWL_BOT_IGNORE}.`
    );
    return null;
  }

  const zipFilePath = uuidv4() + '.zip';
  const [prOwner, prRepo] = prData.head.repo.full_name.split('/');
  const buildResponse = await runTrigger(
    {
      projectId: project,
      triggerId: args.trigger,
      source: {
        projectId: project,
        branchName: 'main', // TODO: It might fail if we change the default branch.
        substitutions: {
          _PR: args.pr.toString(),
          _PR_BRANCH: prData.head.ref,
          _PR_OWNER: prOwner,
          _REPOSITORY: prRepo,
          // _CONTAINER must contain the image digest. For example:
          // gcr.io/repo-automation-tools/nodejs-post-processor**@1234abcd**
          _CONTAINER: args.image,
          _DEFAULT_BRANCH: args.defaultBranch ?? 'master',
          _CLOUD_STORAGE_BUCKET: 'repo-automation-bots-post-processor-logs',
          _CLOUD_STORAGE_PATH: zipFilePath,
        },
      },
    },
    project
  );
  if ('success' === buildResponse.conclusion) {
    // unzipAndPush
  }
  return buildResponse;
}

export async function triggerPostProcessBuild(
  args: BuildArgs,
  octokit?: OctokitType
): Promise<BuildResponse | null> {
  const token = await core.getGitHubShortLivedAccessToken(
    args.privateKey,
    args.appId,
    args.installation
  );
  const project = projectIdFromArgs(args);
  const [owner, repo] = args.repo.split('/');
  if (!octokit) {
    octokit = await core.getAuthenticatedOctokit(token.token);
  }
  const {data: prData} = await octokit.pulls.get({
    owner,
    repo,
    pull_number: args.pr,
  });

  // See if someone asked owl bot to ignore this PR.
  if (prData.labels.find(label => label.name === OWL_BOT_IGNORE)) {
    logger.info(
      `Ignoring ${owner}/${repo} #${args.pr} because it's labeled with ${OWL_BOT_IGNORE}.`
    );
    return null;
  }

  const [prOwner, prRepo] = prData.head.repo.full_name.split('/');
  return await runTrigger(
    {
      projectId: project,
      triggerId: args.trigger,
      source: {
        projectId: project,
        branchName: 'main', // TODO: It might fail if we change the default branch.
        substitutions: {
          _GITHUB_TOKEN: token.token,
          _PR: args.pr.toString(),
          _PR_BRANCH: prData.head.ref,
          _PR_OWNER: prOwner,
          _REPOSITORY: prRepo,
          // _CONTAINER must contain the image digest. For example:
          // gcr.io/repo-automation-tools/nodejs-post-processor**@1234abcd**
          _CONTAINER: args.image,
          _DEFAULT_BRANCH: args.defaultBranch ?? 'master',
        },
      },
    },
    project
  );
}

/**
 * Runs the build trigger, waits for it to complete, logs errors,
 * and returns a BuildResponse.
 */
async function runTrigger(
  request: google.devtools.cloudbuild.v1.IRunBuildTriggerRequest,
  project: string
): Promise<BuildResponse> {
  const cb = core.getCloudBuildInstance();
  const [resp] = await cb.runBuildTrigger(request);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buildId: string = (resp as any).metadata.build.id;
  const detailsURL = detailsUrlFrom(buildId, project);
  try {
    // TODO(bcoe): work with fenster@ to figure out why awaiting a long
    // running operation does not behave as expected:
    // const [build] = await resp.promise();
    const build = await waitForBuild(project, buildId, cb);
    return {detailsURL, ...summarizeBuild(build)};
  } catch (e) {
    const err = e as Error;
    logger.error(err);
    return buildFailureFrom(detailsURL);
  }
}

function summarizeBuild(
  build: google.devtools.cloudbuild.v1.IBuild
): BuildSummary {
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
}

function buildFailureFrom(detailsUrl: string): BuildResponse {
  return {
    conclusion: 'failure',
    summary: 'unknown build failure',
    text: 'unknown build failure',
    detailsURL: detailsUrl,
  };
}

// Helper to build a link to the Cloud Build job, which peers in DPE
// can use to view a given post processor run:
function detailsUrlFrom(buildID: string, project: string): string {
  return `https://console.cloud.google.com/cloud-build/builds;region=global/${buildID}?project=${project}`;
}

async function waitForBuild(
  projectId: string,
  id: string,
  client: CloudBuildClient
): Promise<google.devtools.cloudbuild.v1.IBuild> {
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
  const prName = `${args.repo} #${args.pr}`;
  const headCommit = await getHeadCommit(owner, repo, Number(args.pr), octokit);
  if (!headCommit) {
    logger.warn(`No commit found for ${prName}.`);
    return;
  }
  const response = await octokit.checks.create({
    owner,
    repo,
    name: 'OwlBot Post Processor',
    summary: args.summary,
    head_sha: headCommit.sha as string,
    conclusion: args.conclusion,
    details_url: args.detailsURL,
    output: {
      title: args.title,
      summary: args.summary,
      text: args.text,
    },
  });
  if (201 === response.status) {
    logger.info(`Created check for ${prName}: ${response.data.html_url}`);
  } else {
    logger.error(
      `Failed to create check for ${prName}.  ` +
        `Status: ${response.status}.\n` +
        JSON.stringify(response)
    );
  }
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
export async function fetchOwlBotLock(
  repoFull: string,
  pullNumber: number,
  octokit: OctokitType
): Promise<string | undefined> {
  const [owner, repo] = repoFull.split('/');
  const {data: prData} = await octokit.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
  });
  const [prOwner, prRepo] = prData.head.repo.full_name.split('/');
  const configString = await getFileContent(
    prOwner,
    prRepo,
    OWL_BOT_LOCK_PATH,
    prData.head.ref,
    octokit
  );
  return configString;
}

export function parseOwlBotLock(configString: string): OwlBotLock {
  const maybeOwlBotLock = load(configString);
  if (maybeOwlBotLock === null || typeof maybeOwlBotLock !== 'object') {
    throw new Error(`Lock file did not parse correctly.  Expected an object.
Found ${maybeOwlBotLock}
while parsing
${configString}`);
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
  } catch (e) {
    const err = e as RequestError;
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
  // It's okay to have 4 commits from Owl-Bot in a row, e.g., a commit for
  // a code update plus the post processor.
  //
  // It's also okay to run the post-processor many more than circuitBreaker
  // times on a long lived PR, with human edits being made.
  const circuitBreaker = 5;
  // TODO(bcoe): we should move to an async iterator for listCommits:
  const commits = (
    await octokit.pulls.listCommits({
      pull_number: prNumber,
      owner,
      repo,
      per_page: 100,
    })
  ).data;

  // get the most recent commits (limit by circuit breaker)
  const lastFewCommits = commits
    .sort((a, b) => {
      const aDate = new Date(a.commit.author?.date || 0);
      const bDate = new Date(b.commit.author?.date || 0);

      // sort desc
      return bDate.valueOf() - aDate.valueOf();
    })
    .slice(0, circuitBreaker);

  // not enough commits to trigger a circuit breaker
  if (lastFewCommits.length < circuitBreaker) return false;

  for (const commit of lastFewCommits) {
    if (commit?.author?.login !== OWLBOT_USER) return false;
  }

  // all of the recent commits were from owl-bot
  return true;
}

/*
 * Return whether or not the last commit was from OwlBot.
 *
 * @param owner owner of repo.
 * @param repo short repo name.
 * @param prNumber PR to check for commit.
 * @param octokit authenticated instance of octokit.
 * @returns Promise was the last commit from OwlBot?
 */
async function lastCommitFromOwlBot(
  owner: string,
  repo: string,
  prNumber: number,
  octokit: Octokit
): Promise<boolean> {
  // TODO(bcoe): we should move to an async iterator for listCommits in the
  // future, so that we can handle more than 100:
  const commits = (
    await octokit.pulls.listCommits({
      pull_number: prNumber,
      owner,
      repo,
      per_page: 100,
    })
  ).data;
  const commit = commits[commits.length - 1];
  return commit?.author?.login === OWLBOT_USER;
}

/**
 * After the post processor runs, we may want to close the pull request or
 * promote it to "ready for review."
 */
async function updatePullRequestAfterPostProcessor(
  owner: string,
  repo: string,
  prNumber: number,
  octokit: Octokit
): Promise<void> {
  const {data: pull} = await octokit.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });
  // If someone asked owl bot to ignore this PR, never close or promote it.
  if (pull.labels.find(label => label.name === OWL_BOT_IGNORE)) {
    logger.info(
      `I won't close or promote ${owner}/${repo} #${prNumber} because it's labeled with ${OWL_BOT_IGNORE}.`
    );
    return;
  }
  // If the pull request was not created by owl bot, never close or promote it.
  const owlBotLabels = [OWL_BOT_LOCK_UPDATE, OWL_BOT_COPY];
  if (!pull.labels.find(label => owlBotLabels.indexOf(label.name ?? '') >= 0)) {
    logger.info(
      `I won't close or promote ${owner}/${repo} #${prNumber} because it's not labeled with ${owlBotLabels}.`
    );
    return;
  }
  // If running post-processor has created a noop change, close the
  // pull request:
  const files = (
    await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: prNumber,
    })
  ).data;
  if (!files.length) {
    await octokit.pulls.update({
      owner,
      repo,
      pull_number: prNumber,
      state: 'closed',
    });
  } else {
    // If the pull request is a DRAFT lock file update, close it or promote it.
    if (
      pull.draft &&
      pull.labels.find(label => label.name === OWL_BOT_LOCK_UPDATE)
    ) {
      if (1 === files.length && files[0].filename === OWL_BOT_LOCK_PATH) {
        // It only updated the lock file.  No reason to merge this pull request.
        // Close it.
        await octokit.pulls.update({
          owner,
          repo,
          pull_number: prNumber,
          state: 'closed',
        });
      } else {
        // It triggered changes to READMEs, scripts, etc.  Promote it to
        // "Ready for review".
        await octokit.pulls.update({
          owner,
          repo,
          pull_number: prNumber,
          draft: false,
        });
      }
    }
  }
}

export interface RegenerateArgs {
  owner: string;
  repo: string;
  branch: string;
  prNumber: number;
  prBody: string;
  gcpProjectId: string;
  buildTriggerId: string;
}

export async function triggerRegeneratePullRequest(
  octokitFactory: OctokitFactory,
  args: RegenerateArgs
): Promise<void> {
  const token = await octokitFactory.getGitHubShortLivedAccessToken();
  const octokit = await octokitFactory.getShortLivedOctokit(token);
  // No matter what the outcome, we'll create a comment below.
  const _createComment = async (body: string): Promise<void> => {
    await octokit.issues.createComment({
      owner: args.owner,
      repo: args.repo,
      issue_number: args.prNumber,
      body,
    });
  };

  const reportError = (error: string) => {
    console.error(error);
    return _createComment(error);
  };

  const reportInfo = (text: string) => {
    console.info(text);
    return _createComment(text);
  };

  let sourceHash = '';
  let yamlPath = DEFAULT_OWL_BOT_YAML_PATH;

  // The user checked the "Regenerate this pull request" box.

  // First try to unpack the source commit hash and .OwlBot.yaml path from
  // a Copy Tag.
  const copyTagText = findCopyTag(args.prBody);
  if (copyTagText) {
    try {
      const copyTag = unpackCopyTag(copyTagText);
      sourceHash = copyTag.h;
      yamlPath = copyTag.p;
      console.info(`Found Copy-Tag: ${copyTag}`);
    } catch (e) {
      await reportError(
        `Owl Bot could not regenerate pull request ${args.prNumber} because the Copy-Tag is corrupt.\n${e}`
      );
      return;
    }
  }

  // Older pull requests won't have a Copy-Tag, so use the commit hash
  if (!sourceHash) {
    sourceHash = findSourceHash(args.prBody);
  }
  if (!sourceHash) {
    // But there's no source hash to regenerate from.  Oh no!
    const sourceLine = sourceLinkLineFrom(sourceLinkFrom('abc123'));
    await reportError(`Owl Bot could not regenerate pull request ${args.prNumber} because the body is missing a source hash.

A source hash in the source link looks like this:
${sourceLine}`);
    return;
  }
  let buildName = '';
  try {
    const cb = core.getCloudBuildInstance();
    // Is there a reason to wait for for the long-running build to complete
    // here?
    const [resp] = await cb.runBuildTrigger({
      projectId: args.gcpProjectId,
      triggerId: args.buildTriggerId,
      source: {
        projectId: args.gcpProjectId,
        branchName: 'main', // TODO: It might fail if we change the default branch.
        substitutions: {
          _GITHUB_TOKEN: token,
          _PR: args.prNumber.toString(),
          _PR_BRANCH: args.branch,
          _PR_OWNER: args.owner,
          _REPOSITORY: args.repo,
          _SOURCE_HASH: sourceHash,
          _OWL_BOT_YAML_PATH: yamlPath,
        },
      },
    });
    buildName = resp?.name ?? '';
  } catch (err) {
    await reportError(`Owl Bot failed to regenerate pull request ${args.prNumber}.

${err}`);
    return;
  }
  await reportInfo(`Owl bot is regenerating pull request ${args.prNumber}...
Build name: ${stripBuildName(buildName)}`);
}

/**
 * The build name returned by runBuildTrigger includes a full path with the
 * project name, and I'd rather not show that to the world.
 */
function stripBuildName(buildName: string): string {
  const chunks = buildName.split(/\//);
  return chunks.length > 0 ? chunks[chunks.length - 1] : '';
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
  fetchOwlBotLock,
  parseOwlBotLock,
  hasOwlBotLoop,
  lastCommitFromOwlBot,
  OWL_BOT_LOCK_PATH,
  triggerPostProcessBuild,
  triggerRegeneratePullRequest,
  updatePullRequestAfterPostProcessor,
  OWL_BOT_LOCK_UPDATE: OWL_BOT_LOCK_UPDATE,
};
