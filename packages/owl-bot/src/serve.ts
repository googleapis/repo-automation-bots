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

import * as http from 'http';

/**
 * Runs a webserver that scans the configs whenever the url path is requested.
 *
 * @param port the port number to listen to
 * @param path the uri path to listen to; must begin with a /
 * @param callback the function to invoke when the path is fetched
 */
export async function serve(
  port: number,
  path: string,
  callback: () => Promise<void>
) {
  const server = http.createServer(async (req, res) => {
    // Require the specified path because health checks and the like may
    // arrive at / or other urls, and we don't want to kick off a 20-minute,
    // github-quota-consuming scan for every such request.
    if (path === req.url) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain');
      res.write('Working...\n');
      try {
        await callback();
        res.end('Done.');
      } catch (e) {
        console.error(e);
        res.end('Error.  See logs.');
      }
    } else {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end(`You're probably looking for ${path}.`);
    }
  });
  console.log('Listening on port ' + port);
  server.listen(port);
}
