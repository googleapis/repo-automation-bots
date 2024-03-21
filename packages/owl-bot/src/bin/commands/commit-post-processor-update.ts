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

// Invoked by update-pr.yaml to commit changes to an open pull request after
// the post processor runs.
//
// This used to be a simple "git commit ...", but the addition of the
// squash flag in .OwlBot.yaml makes it more complicated.  When squash
// is true and the most recent commit was a copy from googleapis-gen, then
// we want to squash the changes made by the post processor.

import {cwd} from 'process';
import yargs = require('yargs');
import {newCmd} from '../../cmd';
import {findCopyTags, loadOwlBotYaml, unpackCopyTag} from '../../copy-code';
import {OWL_BOT_IGNORE} from '../../labels';
import {OWL_BOT_POST_PROCESSOR_COMMIT_MESSAGE} from '../../constants';
import {OctokitFactory} from '../../octokit-util';
import * as proc from 'child_process';
import path = require('path');
import {githubRepoFromOwnerSlashName} from '../../github-repo';
import {hasGitChanges} from '../../git-utils';
import * as fs from 'fs';
import {resplit, WithRegenerateCheckbox} from '../../create-pr';
import {OWL_BOT_COPY} from '../../core';
import {octokitFactoryFromArgsOrEnvironment} from './credentials-loader';

interface Args {
  'dest-repo': string;
  pr: number;
  'github-token'?: string;
  'repo-path': string;
  'new-pull-request-text-path': string;
  installation: number;
}
interface CommitUpdateArgs {
  'dest-repo': string;
  pr: number;
  'repo-path': string;
  'new-pull-request-text-path': string;
  octokitFactory: OctokitFactory;
}

export const commitPostProcessorUpdateCommand: yargs.CommandModule<{}, Args> = {
  command: 'commit-post-processor-update',
  describe:
    'Runs either `git commit -m "Updates from OwlBot"` or ' +
    '`git commit --amend --no-edit`\n' +
    'depending on the squash flag in .OwlBot.yaml.\n\n' +
    'Run this command in the root directory of a client library repository ' +
    'after running the post processor.',
  builder(yargs) {
    return yargs
      .option('dest-repo', {
        describe: "The PR's destination repo (e.g., googleapis/foo)",
        type: 'string',
        demand: true,
      })
      .option('installation', {
        describe: 'The GitHub app installation ID.',
        type: 'number',
        demand: true,
      })
      .option('pr', {
        describe: 'The pull request number',
        type: 'number',
        demand: true,
      })
      .option('github-token', {
        describe: 'Short-lived GitHub token.',
        type: 'string',
      })
      .option('new-pull-request-text-path', {
        describe:
          'Path to a text file containing the new pull request title and body.',
        type: 'string',
        default: '',
      })
      .option('repo-path', {
        describe: 'Local path to the repository',
        type: 'string',
        default: cwd(),
      });
  },
  handler: async argv => {
    const octokitFactory = await octokitFactoryFromArgsOrEnvironment(argv);
    const {pullRequestToPromote} = await commitPostProcessorUpdate({
      ...argv,
      octokitFactory,
    });
    if (pullRequestToPromote) {
      await promoteFromDraft(pullRequestToPromote, octokitFactory);
    }
  },
};

interface PRLocator {
  owner: string;
  repo: string;
  pull_number: number;
}

interface AfterCommitPostProcessorUpdate {
  /// When present, the pull request should be marked ready for review.
  pullRequestToPromote?: PRLocator;
}

export async function commitPostProcessorUpdate(
  args: CommitUpdateArgs
): Promise<AfterCommitPostProcessorUpdate> {
  const octokitFactory = args.octokitFactory;
  const octokit = await octokitFactory.getShortLivedOctokit();
  const repo = githubRepoFromOwnerSlashName(args['dest-repo']);

  const cmd = newCmd(console);
  let repoDir = args['repo-path'];
  if (['', '.'].includes(repoDir)) {
    repoDir = cwd();
  }

  // Check if the ignore label has been added during the post-processing.
  // If so, do not push changes.
  console.log(`Retrieving PR info for ${repo}`);
  const prLocator = {
    owner: repo.owner,
    repo: repo.repo,
    pull_number: args.pr,
  };
  const {data: prData} = await octokit.pulls.get(prLocator);
  console.log(`Retrieved PR info for ${repo}`);

  if (prData.labels.find(label => label.name === OWL_BOT_IGNORE)) {
    console.log(
      `Not making any changes to ${repo}#${args.pr} because it's labeled with ${OWL_BOT_IGNORE}.`
    );
    return {};
  }

  // https://github.com/googleapis/repo-automation-bots/issues/5034
  // explains why some pull requests are promoted from draft to full.
  const result: AfterCommitPostProcessorUpdate = {
    pullRequestToPromote:
      prData.draft && prData.labels.some(label => label.name === OWL_BOT_COPY)
        ? prLocator
        : undefined,
  };

  // Add all pending changes to the commit.
  cmd('git add -A .', {cwd: repoDir});
  if (!(await hasGitChanges(repoDir))) {
    console.log(
      "The post processor made no changes; I won't commit any changes."
    );
    return result; // No changes made.  Nothing to do.
  }

  // Unpack the Copy-Tag.
  const body = cmd('git log -1 --format=%B', {cwd: repoDir}).toString('utf-8');
  const copyTagText = findCopyTags(body)[0];
  if (copyTagText) {
    try {
      const copyTag = unpackCopyTag(copyTagText);
      // Look in .OwlBot.yaml for a squash flag.
      const yaml = await loadOwlBotYaml(path.join(repoDir, copyTag.p));
      if (yaml.squash) {
        // There's no reason to run hooks, and they could potentially execute
        // untrusted code, so pass --no-verify.
        // Amend (squash) pending changes into the previous commit.
        cmd('git commit --no-verify --amend --no-edit', {cwd: repoDir});
        // Must force push back to origin.
        cmd('git push --no-verify -f', {cwd: repoDir});
        return result;
      }
    } catch (e) {
      console.error(e);
    }
  }
  // Commit new changes as a new commit.
  commitOwlbotUpdate(repoDir);
  // There's no reason to run hooks, and they could potentially execute
  // untrusted code, so pass --no-verify.
  // Pull any recent changes to minimize risk of missing refs for the user.
  cmd('git pull --no-verify', {cwd: repoDir});
  // Push changes back to origin.
  cmd('git push --no-verify', {cwd: repoDir});

  // Update the PR title and body if new ones were provided.
  const text_path = args['new-pull-request-text-path'];
  if (text_path && fs.existsSync(text_path)) {
    const text = fs.readFileSync(text_path).toString();
    const prContent = resplit(text, WithRegenerateCheckbox.No);
    await octokit.pulls.update({...prLocator, ...prContent});
  }
  return result;
}

export function commitOwlbotUpdate(repoDir: string) {
  // Use spawn() instead of cmd() to avoid the shell potentially
  // misinterpreting commit message.
  const commitMessage = OWL_BOT_POST_PROCESSOR_COMMIT_MESSAGE;
  console.log(`git commit -m "${commitMessage}"`);
  proc.spawnSync('git', ['commit', '-m', commitMessage], {cwd: repoDir});
}

async function promoteFromDraft(
  prLocator: PRLocator,
  octokitFactory: OctokitFactory
): Promise<void> {
  const octokit = await octokitFactory.getShortLivedOctokit();
  const found = (await octokit.graphql(
    `
    query findPullRequestID($owner: String!, $repo: String!, $pullNumber: Int!) {
      repository(owner:$owner, name:$repo) {
        pullRequest(number:$pullNumber) {
          id
        }
      }
    }`,
    {
      owner: prLocator.owner,
      repo: prLocator.repo,
      pullNumber: prLocator.pull_number,
    }
  )) as any; // eslint-disable-line

  await octokit.graphql(
    `
    mutation markPullRequestReadyForReview($pullRequestId: ID!) {
      markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {
        clientMutationId
      }
    }`,
    {
      pullRequestId: found.repository.pullRequest.id,
    }
  );
}
