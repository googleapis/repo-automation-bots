// Copyright 2022 Google LLC
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
import {Octokit} from '@octokit/rest';
// eslint-disable-next-line node/no-extraneous-import
import {Probot} from 'probot';
import {getContextLogger, getAuthenticatedOctokit} from 'gcf-utils';
import {getConfig} from '@google-automations/bot-config-utils';
import {AnnotationScanner} from './scanner';

const CONFIGURATION_FILE_PATH = 'todo-bot.yml';
const DEFAULT_ANNOTATIONS = ['TODO'];

interface Configuration {
  annotations?: string[];
  branch?: string;
}

export = (app: Probot) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.on('schedule.repository' as any, async context => {
    const logger = getContextLogger(context);
    const owner = context.payload.organization.login;
    const repo = context.payload.repository.name;
    let octokit: Octokit;
    if (context.payload.installation?.id) {
      octokit = await getAuthenticatedOctokit(context.payload.installation.id);
    } else {
      throw new Error(
        `Installation ID not provided in ${context.payload.action} event.` +
          ' We cannot authenticate Octokit.'
      );
    }

    const config = await getConfig<Configuration>(
      octokit,
      owner,
      repo,
      CONFIGURATION_FILE_PATH
    );
    const annotations = config?.annotations ?? DEFAULT_ANNOTATIONS;
    const branch =
      config?.branch ?? (await getDefaultBranch(octokit, owner, repo));

    logger.info(`Scanning repository for TODOs: ${owner}/${repo}`);
    const scanner = new AnnotationScanner(owner, repo, branch, {logger});
    const foundAnnotations = await scanner.findAnnotations(annotations);

    // TODO: do something interesting with the scan results
    logger.info(
      `Found ${foundAnnotations.length} annotations:`,
      foundAnnotations
    );
  });
};

async function getDefaultBranch(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<string> {
  const {
    data: {default_branch: branch},
  } = await octokit.repos.get({
    owner,
    repo,
  });
  return branch;
}
