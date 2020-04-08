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

import {GCFBootstrapper} from 'gcf-utils';
import appFn from './blunderbuss';
import express from 'express';
import {config} from 'dotenv';
import {urlencoded, json} from 'body-parser';
import {resolve} from 'path';

const out = config({path: resolve(__dirname, '../../.env')});
console.log(out);

const bootstrap = new GCFBootstrapper();
const handler = bootstrap.gcf(appFn);

const app = express();
app.use(urlencoded());
app.use(json());

app.all('/', (req: express.Request, res: express.Response) => {
  handler(req, res);
});

const port = 3000;

app.listen(port, () => {
  console.log(`listening on http://localhost:${port}`);
});
