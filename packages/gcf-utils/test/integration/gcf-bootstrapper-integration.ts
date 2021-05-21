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

import {GCFBootstrapper} from '../../src/gcf-utils';
import {describe, beforeEach, afterEach, it} from 'mocha';
import {Probot} from 'probot';
import {Octokit as GitHubAPI} from '@octokit/rest';
import {resolve} from 'path';
import {config} from 'dotenv';
import assert from 'assert';
import {VERSION as OCTOKIT_LOGGING_PLUGIN_VERSION} from '../../src/logging/logging-octokit-plugin';

/**
 * How to run these tests:
 *
 * 1. Create a GitHub personal access token:
 *    https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token
 * 2. Create a test GitHub App and give it the necessary permissions,
 *    then note the installation id.
 *
 * 3. Navigate to https://github.com/settings/apps/{your-app} to find
 *    the necessary information for step 4
 * 4. Enable secret manager on your GCP project and create a new secret
 *    with the following values:
 *    {
 *      "id": <your GitHub app id>,
 *      "cert": <your GitHub app private key at the bottom of the page>,
 *      "secret": <your GitHub app's webhook secret (not client secret)>,
 *      "githubToken": <your personal access token from step 1>
 *    }
 * 5. Create a file in gcf-utils root directory called ".env" with the following:
 *    PROJECT_ID=<your GCP project id>
 *    GCF_SHORT_FUNCTION_NAME=<the name of your secret>
 *    INSTALLATION_ID=<installation id of your bot>
 *
 * 6. Run these tests by calling 'npm run system-test'
 */

describe('GCFBootstrapper Integration', () => {
  describe('getAuthenticatedOctokit', () => {
    let bootstrapper: GCFBootstrapper;

    beforeEach(async () => {
      bootstrapper = new GCFBootstrapper();
      config({path: resolve(__dirname, '../../../.env')});
    });

    afterEach(() => {});

    it('creates authenticated Octokit', async () => {
      const installationId =
        process.env.INSTALLATION_ID || '';
      const octokit = await bootstrapper.getAuthenticatedOctokit(
        Number(installationId)
      );
      await octokit.apps.listReposAccessibleToInstallation(
        {
          per_page: 1,
          page: 1
        }
      );
    });
  });
  describe('getProbotConfig', () => {
    let bootstrapper: GCFBootstrapper;

    beforeEach(async () => {
      bootstrapper = new GCFBootstrapper();
      config({path: resolve(__dirname, '../../../.env')});
    });

    afterEach(() => {});

    it('returns valid options', async () => {
      await bootstrapper.getProbotConfig();
    });
  });

  describe('loadProbot', () => {
    let bootstrapper: GCFBootstrapper;

    beforeEach(async () => {
      bootstrapper = new GCFBootstrapper();
      config({path: resolve(__dirname, '../../.env')});
    });

    it('is called properly', async () => {
      let called = false;
      const pb = await bootstrapper.loadProbot((app: Probot) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        app.on('foo' as any, async () => {
          console.log('We are called!');
          called = true;
        });
      });

      await pb.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'foo' as any,
        id: 'bar',
        payload: 'baz',
      });

      assert(called);
    });

    it('provides github with logging plugin', async () => {
      let called = false;
      const pb = await bootstrapper.loadProbot((app: Probot) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        app.on('foo' as any, async context => {
          assert(
            (context.octokit as GitHubAPI & {
              loggingOctokitPluginVersion: string;
            }).loggingOctokitPluginVersion === OCTOKIT_LOGGING_PLUGIN_VERSION
          );
          called = true;
        });
      });

      await pb.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'foo' as any,
        id: 'bar',
        payload: 'baz',
      });

      assert(called);
    });
  });
});
