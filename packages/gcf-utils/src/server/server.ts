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

import express from 'express';
import * as bodyParser from 'body-parser';
import * as http from 'http';
import {HandlerFunction} from '../gcf-utils';

/**
 * Given an Express handler function, build a http.Server instance
 * that can serve the function.
 * @param handler {HandlerFunction} The bot handler function
 * @returns {http.Server}
 */
export function getServer(handler: HandlerFunction): http.Server {
  const app = express();
  app.use(bodyParser.json({limit: '1024mb'}));
  app.enable('trust proxy'); // To respect X-Forwarded-For header.
  // Disable Express 'x-powered-by' header:
  // http://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
  app.disable('x-powered-by');

  // Route all requests to the handler
  app.all('*', handler);

  return http.createServer(app);
}
