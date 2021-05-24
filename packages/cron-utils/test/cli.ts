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

import nock from 'nock';
import {describe, it, afterEach} from 'mocha';
import assert from 'assert';
import sinon from 'sinon';
import * as cli from '../src/cli';
import * as cron_utils from '../src/cron-utils';

const sandbox = sinon.createSandbox();
nock.disableNetConnect();

describe('cli', () => {
  let getProxyUrlStub: sinon.SinonStub;
  beforeEach(() => {
    getProxyUrlStub = sandbox.stub(
      cron_utils,
      'getServerlessSchedulerProxyUrl'
    );
  });
  afterEach(() => {
    sandbox.restore();
  });
  it('should reject if no scheduler proxy url found', async () => {
    getProxyUrlStub.rejects();
    sandbox.replace(cron_utils, 'createOrUpdateCron', async () => {
      assert.fail('should not get here');
    });
    cli
      .parser()
      .exitProcess(false)
      .parse(
        'deploy --scheduler-service-account=foo@bar.com --function-region=us-central1 --region=us-central1 --function-name=my-name',
        this,
        err => {
          assert.ok(err);
        }
      );
    sandbox.assert.calledOnce(getProxyUrlStub);
  });
  it('should handle updating crons', async () => {
    getProxyUrlStub.resolves('https://scheduler.proxy/');
    sandbox.replace(cron_utils, 'parseCronEntries', () => {
      return [{name: 'cron-name', schedule: '0 1 * * *'}];
    });
    sandbox.replace(cron_utils, 'createOrUpdateCron', async () => {
      return 'abc123';
    });
    cli
      .parser()
      .exitProcess(false)
      .parse(
        'deploy --scheduler-service-account=foo@bar.com --function-region=us-central1 --region=us-central1 --function-name=my-name',
        this,
        (err, argv, output) => {
          console.log('error', err);
          console.log('argv', argv);
          console.log('output', output);
        }
      );
    sandbox.assert.calledOnce(getProxyUrlStub);
  });
});
