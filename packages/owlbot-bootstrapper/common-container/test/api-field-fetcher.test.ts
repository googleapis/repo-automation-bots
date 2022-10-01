// Copyright 2022 Google LLC
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

import {describe, it} from 'mocha';
import {Octokit} from '@octokit/rest';
import nock from 'nock';
import {execSync} from 'child_process';
import * as path from 'path';
import assert from 'assert';
import {ApiFieldFetcher} from '../api-field-fetcher';
import {Storage} from '@google-cloud/storage';
import sinon from 'sinon';
import {ApiFields, ReleaseLevel} from '../interfaces';

nock.disableNetConnect();

let directoryPath: string;
let repoToClonePath: string;
const FAKE_REPO_NAME = 'fakeRepo';
const FAKE_WORKSPACE = 'workspace';

describe('Api Field Fetcher class', async () => {
  beforeEach(async () => {
    directoryPath = path.join(__dirname, FAKE_WORKSPACE);
    repoToClonePath = path.join(__dirname, FAKE_REPO_NAME);
    console.log(directoryPath);
    try {
      await execSync(`mkdir ${directoryPath}`);
      await execSync(
        `mkdir ${repoToClonePath}; cd ${repoToClonePath}; git init`
      );
    } catch (err) {
      if (!(err as any).toString().match(/File exists/)) {
        throw err;
      }
    }
  });

  afterEach(async () => {
    await execSync(`rm -rf ${directoryPath}`);
    await execSync(`rm -rf ${repoToClonePath}`);
  });

  const octokit = new Octokit({auth: 'abc1234'});

  it('should create the right type of object', async () => {
    const storage = {
      bucket: sinon.stub().returns({
        file: sinon.stub().returns({
          download: sinon
            .stub()
            .returns(
              '{"apis": [{"api_shortname": "kms", "display_name": "thing1", "docs_root_url": "thing2", "launch_stage": "thing3"}]}'
            ),
        }),
      }),
    } as unknown as Storage;

    const apiFetcher = new ApiFieldFetcher(
      'google.cloud.kms.v1',
      octokit,
      storage
    );

    const expectation = {
      apiId: 'google.cloud.kms.v1',
      octokit: octokit,
      storage: storage,
    };

    assert.deepStrictEqual(apiFetcher.octokit, expectation.octokit);
    assert.deepStrictEqual(apiFetcher.storageClient, expectation.storage);
    assert.deepStrictEqual(apiFetcher.apiId, 'google.cloud.kms.v1');
  });

  it('should get drift metadata', async () => {
    const storage = {
      bucket: sinon.stub().returns({
        file: sinon.stub().returns({
          download: sinon
            .stub()
            .returns(
              '{"apis": [{"api_shortname": "kms", "display_name": "thing1", "docs_root_url": "thing2", "launch_stage": "thing3"}]}'
            ),
        }),
      }),
    } as unknown as Storage;

    assert.deepStrictEqual(
      await ApiFieldFetcher.prototype._getDriftMetadata(
        'google.cloud.kms.v1',
        storage
      ),
      {
        api_shortname: 'kms',
        display_name: 'thing1',
        docs_root_url: 'thing2',
        launch_stage: 'thing3',
      }
    );
  });

  it('should throw an error if file is empty', async () => {
    const storage = {
      bucket: sinon.stub().returns({
        file: sinon.stub().returns({
          download: sinon.stub().returns(undefined),
        }),
      }),
    } as unknown as Storage;

    assert.rejects(
      async () =>
        await ApiFieldFetcher.prototype._getDriftMetadata(
          'google.cloud.kms.v1',
          storage
        ),
      /apis.json downloaded from Cloud Storage was empty/
    );
  });

  it('getAPIInfo should return empty if there was no match', async () => {
    assert.deepStrictEqual(
      await ApiFieldFetcher.prototype._extractApiInfoFromJson(
        [
          {
            api_shortname: 'thing4',
            display_name: 'thing1',
            docs_root_url: 'thing2',
            launch_stage: 'thing3',
          },
        ],
        'google.cloud.kms.v1'
      ),
      {
        api_shortname: 'kms',
        display_name: '',
        docs_root_url: '',
        launch_stage: '',
      }
    );
  });

  it('should get fields from api_proto.yaml in Github', async () => {
    const fileRequest = nock('https://api.github.com')
      .get('/repos/googleapis/googleapis/contents/google%2Fcloud%2Fkms%2Fv1')
      .reply(200, [
        {
          name: 'cloudkms_v1.yaml',
        },
        {
          name: 'cloudkms_grpc_service_config.json',
        },
        {
          name: 'cloudkms_gapic.yaml',
        },
      ])
      .get(
        '/repos/googleapis/googleapis/contents/google%2Fcloud%2Fkms%2Fv1%2Fcloudkms_v1.yaml'
      )
      .reply(200, {
        content:
          'e3R5cGU6IGdvb2dsZS5hcGkuU2VydmljZSwgY29uZmlnX3ZlcnNpb246IDMsIG5hbWU6IGNsb3Vka21zLmdvb2dsZWFwaXMuY29tLCB0aXRsZTogQ2xvdWQgS2V5IE1hbmFnZW1lbnQgU2VydmljZSAoS01TKSBBUEl9',
      });
    const apiProtoFields =
      await ApiFieldFetcher.prototype._getApiProtoInformation(
        octokit,
        'google.cloud.kms.v1'
      );

    assert.deepStrictEqual(apiProtoFields, {
      name: 'cloudkms.googleapis.com',
      title: 'Cloud Key Management Service (KMS) API',
    });

    fileRequest.done();
  });

  it('should compile variables correctly', async () => {
    const getDriftMetadataStub = sinon
      .stub(ApiFieldFetcher.prototype, '_getDriftMetadata')
      .resolves({
        api_shortname: 'kms',
        display_name: '',
        docs_root_url: 'thing2',
        launch_stage: 'thing3',
      });

    const getApiInfoStub = sinon
      .stub(ApiFieldFetcher.prototype, '_getApiProtoInformation')
      .resolves({
        name: 'cloudkms.googleapis.com',
        title: 'Cloud Key Management Service (KMS) API',
      });

    const variables = await ApiFieldFetcher.prototype.loadApiFields();

    console.log(variables);
    assert.deepStrictEqual(variables, {
      apiShortName: 'kms',
      apiPrettyName: 'Cloud Key Management Service (KMS) API',
      apiProductDocumentation: 'thing2',
      apiReleaseLevel: 'thing3',
      apiId: 'cloudkms.googleapis.com',
    });

    assert.ok(getDriftMetadataStub.calledOnce);
    assert.ok(getApiInfoStub.calledOnce);
    getDriftMetadataStub.restore();
    getApiInfoStub.restore();
  });
});
