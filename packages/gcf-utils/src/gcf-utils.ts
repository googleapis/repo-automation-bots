/**
 * Copyright 2019 Google LLC. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { createProbot, Probot, ApplicationFunction, Options, Application } from 'probot';
import { resolve } from 'probot/lib/resolver';
import { Storage } from '@google-cloud/storage';
import * as KMS from '@google-cloud/kms';
import { readFileSync } from 'fs';
import * as express from 'express';


export class GCFBootstrapper {
  probot?: Probot;

  async loadProbot(appFn: ApplicationFunction): Promise<Probot> {
    if (!this.probot) {
      const cfg = await this.getProbotConfig();
      this.probot = createProbot(cfg);
    }

    if (typeof appFn === 'string') {
      appFn = resolve(appFn)
    }

    this.probot.load(appFn)

    return this.probot
  }

  async getProbotConfig(): Promise<Options> {

    const storage = new Storage();
    const kmsclient = new KMS.KeyManagementServiceClient();

    const destFileName = "/tmp/creds.json";
    const bucketName = process.env.DRIFT_PRO_BUCKET || '';
    const srcFilename = process.env.GCF_SHORT_FUNCTION_NAME || '';

    const options = {
      destination: destFileName,
    };

    // Downloads the file
    await storage.bucket(bucketName)
      .file(srcFilename)
      .download(options);


    const contentsBuffer = readFileSync(destFileName);
    const name = kmsclient.cryptoKeyPath(
      process.env.PROJECT_ID || '',
      process.env.KEY_LOCATION || '',
      process.env.KEY_RING || '',
      process.env.GCF_SHORT_FUNCTION_NAME || ''
    );

    const ciphertext = contentsBuffer.toString('base64');

    // Decrypts the file using the specified crypto key
    const [result] = await kmsclient.decrypt({ name, ciphertext });

    const config = JSON.parse(result.plaintext.toString());
    return config
  }

  async gcf(appFn: ApplicationFunction): Promise<(request: express.Request, response: express.Response) => Promise<void>> {
    return async (request: express.Request, response: express.Response) => {
      // Otherwise let's listen handle the payload
      this.probot = this.probot || await this.loadProbot(appFn);

      // Determine incoming webhook event type
      const name = request.get('x-github-event') || request.get('X-GitHub-Event');
      const id = request.get('x-github-delivery') || request.get('X-GitHub-Delivery') || '';

      // Do the thing
      if (name) {
        try {
          await this.probot.receive({
            name,
            id,
            payload: request.body
          });
          response.send({
            statusCode: 200,
            body: JSON.stringify({ message: 'Executed' })
          });
        } catch (err) {
          response.send({
            statusCode: 500,
            body: JSON.stringify({ message: err })
          });
        }
      } else {
        response.sendStatus(400);
      }
    }
  }
}