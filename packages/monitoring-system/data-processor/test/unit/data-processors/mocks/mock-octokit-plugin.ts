// Copyright 2020 Google LLC
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
//
// eslint-disable-next-line node/no-extraneous-import

import {Octokit} from '@octokit/rest';
import {OctokitMiddleware} from './octokit-middleware';
import {OctokitRequestOptions} from './octokit-request-parser';

/**
 * Intercepts outgoing Octokit requests and reroutes
 * them to OctokitMiddleware
 */
module.exports = (
  octokit: Octokit,
  pluginOptions: {middleware: OctokitMiddleware}
) => {
  octokit.hook.wrap('request', async (request, options) => {
    return await pluginOptions.middleware.getMockResponse(
      options as OctokitRequestOptions
    );
  });
};
