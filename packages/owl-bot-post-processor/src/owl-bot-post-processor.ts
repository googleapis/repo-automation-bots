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

// eslint-disable-next-line node/no-extraneous-import
import {Probot} from 'probot';
import {logger} from 'gcf-utils';
import {core} from '../src/core';

// The following environment variables must be set in the deployment:
if (!process.env.APP_ID) throw Error('must set APP_ID');
const appId = Number(process.env.APP_ID);
if (!process.env.GCLOUD_PROJECT) throw Error('must set GCLOUD_PROJECT');
const project: string = process.env.GCLOUD_PROJECT;
if (!process.env.GITHUB_PRIVATE_KEY) throw Error('must set GITHUB_PRIVATE_KEY');
const privateKey: string = process.env.GITHUB_PRIVATE_KEY;
if (!process.env.CLOUD_BUILD_TRIGGER)
  throw Error('must set CLOUD_BUILD_TRIGGER');
const trigger: string = process.env.CLOUD_BUILD_TRIGGER;

export = (app: Probot) => {
  app.on('pull_request', async context => {
    // If the pull request is from a fork, the label "owlbot:run" must be
    // added by a maintainer to trigger the post processor:
    const head = context.payload.pull_request.head;
    const base = context.payload.pull_request.base;
    const installation = context.payload.installation?.id;
    if (!installation) {
      logger.error(`no installation token found for ${head.repo.full_name}`);
      return;
    }
    if (head.repo.full_name !== base.repo.full_name) {
      logger.info(
        `head ${head.repo.full_name} does not match base ${base.repo.full_name} skipping`
      );
      return;
    }
    // Fetch the .Owlbot.lock.yaml from the head ref:
    const lock = await core.getOwlBotLock(
      head.repo.full_name,
      context.payload.number,
      context.octokit
    );
    const image = `${lock.docker.image}@${lock.docker.digest}`;
    // Run time image from .Owlbot.lock.yaml on Cloud Build:
    const buildStatus = await core.triggerBuild(
      {
        image,
        project,
        privateKey,
        appId,
        installation,
        repo: head.repo.full_name,
        pr: context.payload.number,
        trigger,
      },
      context.octokit
    );
    // Update pull request with status of job:
    await core.createCheck(
      {
        privateKey,
        appId,
        installation,
        pr: context.payload.number,
        repo: head.repo.full_name,
        text: buildStatus.text,
        summary: buildStatus.summary,
        conclusion: buildStatus.conclusion,
        title: `🦉 OwlBot - ${buildStatus.summary}`,
      },
      context.octokit
    );
  });
};
