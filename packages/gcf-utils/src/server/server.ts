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
import {HandlerFunction, RequestWithRawBody} from '../gcf-utils';

/**
 * Retains a reference to the raw body buffer to allow access to the raw body
 * for things like request signature validation.  This is used as the "verify"
 * function in body-parser options.
 * @param req Express request object.
 * @param res Express response object.
 * @param buf Buffer to be saved.
 */
function rawBodySaver(
  req: express.Request,
  res: express.Response,
  buf: Buffer
) {
  (req as RequestWithRawBody).rawBody = buf;
}

/**
 * Given an Express handler function, build a http.Server instance
 * that can serve the function.
 * @param handler {HandlerFunction} The bot handler function
 * @returns {http.Server}
 */
export function getServer(handler: HandlerFunction): http.Server {
  const app = express();
  app.use(bodyParser.json({limit: '1024mb', verify: rawBodySaver}));
  app.enable('trust proxy'); // To respect X-Forwarded-For header.
  // Disable Express 'x-powered-by' header:
  // http://expressjs.com/en/advanced/best-practice-security.html#at-a-minimum-disable-x-powered-by-header
  app.disable('x-powered-by');

  // Route all requests to the handler
  app.all('*', (req, res) => {
    // our handler is async, but express expects a synchronous function
    handler(req, res)
      .then(() => {
        res.end();
      })
      .catch(e => {
        console.log(e);
        res.end();
      });
  });

  return http.createServer(app);
}
