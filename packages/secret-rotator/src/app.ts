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

import express, {Request, Response} from 'express';
import {GoogleAuth} from 'google-auth-library';
import {SecretRotator} from './secret-rotator';
import {iam} from '@googleapis/iam';
import {SecretManagerServiceClient} from '@google-cloud/secret-manager';
import {logger} from 'gcf-utils';
export const app = express();

app.use(express.json());

app.post('/rotate-service-account-key', async (req: Request, res: Response) => {
  const serviceAccountProjectId = req.body.serviceAccountProjectId;
  const serviceAccountEmail = req.body.serviceAccountEmail;
  const secretManagerProjectId = req.body.secretManagerProjectId;
  const secretName = req.body.secretName;

  if (!serviceAccountProjectId) {
    logger.error('No service account project ID specified');
    res.sendStatus(400).send('No service account project ID specified');
    return;
  } else if (!serviceAccountEmail) {
    logger.error('No service account email specified');
    res.sendStatus(400).send('No service account email specified');
    return;
  } else if (!secretManagerProjectId) {
    logger.error('No secret manager project ID specified');
    res.sendStatus(400).send('No secret manager project ID specified');
    return;
  } else if (!secretName) {
    logger.error('No secret name specified');
    res.sendStatus(400).send('No secret name specified');
    return;
  }

  const auth = await new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
  const iamClient = await iam({
    version: 'v1',
    auth,
  });
  const secretManagerClient = new SecretManagerServiceClient({auth});

  const helper = new SecretRotator(iamClient, secretManagerClient);

  await helper.rotateSecret(
    serviceAccountProjectId,
    serviceAccountEmail,
    secretManagerProjectId,
    secretName
  );

  res.sendStatus(200);
});
