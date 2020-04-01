// Copyright 2019 Google LLC
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

import {createProbot, Probot, ApplicationFunction, Options} from 'probot';
import {Storage} from '@google-cloud/storage';
import * as KMS from '@google-cloud/kms';
import {readFileSync} from 'fs';
import {request} from 'gaxios';
import * as express from 'express';

interface Repos {
  repos: [
    {
      language: string;
      repo: string;
    }
  ];
}

interface Scheduled {
  repo?: string;
  message?: {[key: string]: string};
}

export class GCFBootstrapper {
  probot?: Probot;

  async loadProbot(appFn: ApplicationFunction): Promise<Probot> {
    if (!this.probot) {
      const cfg = await this.getProbotConfig();
      this.probot = createProbot(cfg);
    }

    this.probot.load(appFn);

    return this.probot;
  }

  async getProbotConfig(): Promise<Options> {
    const storage = new Storage();
    const kmsclient = new KMS.KeyManagementServiceClient();

    const destFileName = '/tmp/creds.json';
    const bucketName = process.env.DRIFT_PRO_BUCKET || '';
    const srcFilename = process.env.GCF_SHORT_FUNCTION_NAME || '';

    const options = {
      destination: destFileName,
    };

    // Downloads the file
    await storage.bucket(bucketName).file(srcFilename).download(options);

    const contentsBuffer = readFileSync(destFileName);
    const name = kmsclient.cryptoKeyPath(
      process.env.PROJECT_ID || '',
      process.env.KEY_LOCATION || '',
      process.env.KEY_RING || '',
      process.env.GCF_SHORT_FUNCTION_NAME || ''
    );

    // Decrypts the file using the specified crypto key
    const [result] = await kmsclient.decrypt({
      name,
      ciphertext: contentsBuffer,
    });

    const config = JSON.parse(result.plaintext.toString());
    return config as Options;
  }

  gcf(
    appFn: ApplicationFunction
  ): (request: express.Request, response: express.Response) => Promise<void> {
    return async (request: express.Request, response: express.Response) => {
      // Otherwise let's listen handle the payload
      this.probot = this.probot || (await this.loadProbot(appFn));

      // Determine incoming webhook event type
      const name =
        request.get('x-github-event') || request.get('X-GitHub-Event');
      const id =
        request.get('x-github-delivery') ||
        request.get('X-GitHub-Delivery') ||
        '';

      // Do the thing
      if (name) {
        try {
          if (name === 'schedule.repository' || name === 'pubsub.message') {
            // TODO: currently we assume that scheduled events walk all repos
            // managed by the client libraries team, it would be good to get more
            // clever and instead pull up a list of repos we're installed on by
            // installation ID:
            await this.handleScheduled(id, request, name);
          } else {
            await this.probot.receive({
              name,
              id,
              payload: request.body,
            });
          }
          response.send({
            statusCode: 200,
            body: JSON.stringify({message: 'Executed'}),
          });
        } catch (err) {
          response.send({
            statusCode: 500,
            body: JSON.stringify({message: err}),
          });
        }
      } else {
        response.sendStatus(400);
      }
    };
  }

  private async handleScheduled(
    id: string,
    req: express.Request,
    eventName: string
  ) {
    let body = (Buffer.isBuffer(req.body)
      ? JSON.parse(req.body.toString('utf8'))
      : req.body) as Scheduled;
    // PubSub messages have their payload encoded in body.message.data
    // as a base64 blob.
    if (body.message && body.message.data) {
      body = JSON.parse(Buffer.from(body.message.data, 'base64').toString());
    }

    if (body.repo) {
      // Job was scheduled for a single repository:
      await this.receivePromise(body.repo, id, body, eventName);
    } else {
      // Job should be run on all managed repositories:
      const url =
        'https://raw.githubusercontent.com/googleapis/sloth/master/repos.json';
      const res = await request<Repos>({url});
      const {repos} = res.data;
      // We process WORK_SIZE repos in parallel:
      const WORK_SIZE = 3;
      while (repos.length) {
        await Promise.all(
          repos.splice(0, WORK_SIZE).map(repo => {
            return this.receivePromise(repo.repo, id, body, eventName);
          })
        );
      }
    }
  }

  private async receivePromise(
    repoFullName: string,
    id: string,
    body: object,
    eventName: string
  ) {
    // The payload from the scheduler is updated with additional information
    // providing context about the organization/repo that the event is
    // firing for.
    const [orgName, repoName] = repoFullName.split('/');
    console.info(`scheduled event ${eventName} for ${repoFullName}`);
    const payload = Object.assign({}, body, {
      repository: {
        name: repoName,
        full_name: repoFullName,
      },
      organization: {
        login: orgName,
      },
    });
    try {
      await this.probot?.receive({
        name: eventName,
        id,
        payload,
      });
    } catch (err) {
      console.warn(err.message);
    }
  }
}
