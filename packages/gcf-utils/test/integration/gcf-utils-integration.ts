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
import { GCFBootstrapper } from '../../src/gcf-utils';

import { Application } from 'probot';
import { resolve } from 'path';
import { config } from 'dotenv';

describe('GCFBootstrapper Integration', () => {
  describe('getProbotConfig', () => {
    let bootstrapper: GCFBootstrapper;

    beforeEach(async () => {
      bootstrapper = new GCFBootstrapper();
      config({ path: resolve(__dirname, '../../../.env') });
    });

    afterEach(() => {});

    it('returns valid options', async () => {
      const options = await bootstrapper.getProbotConfig();
    });
  });

  describe('loadProbot', () => {
    let bootstrapper: GCFBootstrapper;

    beforeEach(async () => {
      bootstrapper = new GCFBootstrapper();
      config({ path: resolve(__dirname, '../../.env') });
    });

    it('is called properly', async () => {
      const pb = await bootstrapper.loadProbot((app: Application) => {
        app.on('foo', async context => {
          console.log('We are called!');
        });
      });

      await pb.receive({
        name: 'foo',
        id: 'bar',
        payload: 'baz',
      });
    });
  });
});
