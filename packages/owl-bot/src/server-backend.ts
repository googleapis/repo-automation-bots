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
import admin from 'firebase-admin';
// eslint-disable-next-line node/no-extraneous-import
import {Probot} from 'probot';
import {GCFBootstrapper} from 'gcf-utils';

import {owlbot} from './owl-bot';

const bootstrap = new GCFBootstrapper();

// Initialize firestore app here to avoid race condition.
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: process.env.FIRESTORE_PROJECT_ID,
});
const db = admin.firestore();

// Unlike other probot apps, owl-bot-post-processor requires the ability
// to generate its own auth token for Cloud Build, we use the helper in
// GCFBootstrapper to load this from Secret Manager:

const server = bootstrap.server(
  async (app: Probot) => {
    const config = await bootstrap.getProbotConfig(false);
    owlbot.OwlBot(config.privateKey, app, db);
  },
  {maxRetries: 10, maxPubSubRetries: 3}
);

const port = process.env.PORT ?? 8080;

server
  .listen(port, () => {
    console.log(`Listening on port ${port}`);
  })
  .setTimeout(0); // Disable automatic timeout on incoming connections.
