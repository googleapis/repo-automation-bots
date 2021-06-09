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
import {GCFBootstrapper} from 'gcf-utils';
import {OwlBot} from './owl-bot';
const bootstrap = new GCFBootstrapper();
// Unlike other probot apps, owl-bot-post-processor requires the ability
// to generate its own auth token for Cloud Build, we use the helper in
// GCFBootstrapper to load this from Secret Manager:
module.exports.owl_bot = bootstrap.gcf(async (app: Probot) => {
  const config = await bootstrap.getProbotConfig(false);
  OwlBot(config.privateKey, app);
});
