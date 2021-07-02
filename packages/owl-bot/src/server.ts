// Copyright 2021 Google LLC
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
import {Probot} from 'probot';
import {GCFBootstrapper} from 'gcf-utils';

const bootstrap = new GCFBootstrapper({
  taskTargetEnvironment: 'functions',
});

// We only need to deploy gcf-utils in the frontend server because only thing
// it does is to enqueue a task for the OwlBot backend. Thus we deploy a dummy
// empty bot code.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const appFn = (app: Probot) => {};

const server = bootstrap.server(appFn);
const port = process.env.PORT ?? 8080;

server
  .listen(port, () => {
    console.log(`Listening on port ${port}`);
  })
  .setTimeout(0); // Disable automatic timeout on incoming connections.
