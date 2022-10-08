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
import {loadApiFields} from '../fetch-api-info';
import {Storage} from '@google-cloud/storage';
import sinon from 'sinon';
import {
  FileNotFoundError,
  RepositoryFileCache,
} from '@google-automations/git-file-utils';

nock.disableNetConnect();

let directoryPath: string;
let repoToClonePath: string;
const FAKE_REPO_NAME = 'fakeRepo';
const FAKE_WORKSPACE = 'workspace';

describe('fetch api related info', async () => {
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

  it('should load the appropriate API information from DRIFT and github if github returns empty', async () => {
    const storage = {
      bucket: sinon.stub().returns({
        file: sinon.stub().returns({
          download: sinon
            .stub()
            .returns(
              '{"apis": [{"api_shortname": "kms", "display_name": "thing1", "docs_root_url": "thing2", "launch_stage": "thing3", "github_label": "thing4"}]}'
            ),
        }),
      }),
    } as unknown as Storage;

    const repositoryFileCache = {
      getFileContents: sinon.stub().returns({parsedContent: '{}'}),
    } as unknown as RepositoryFileCache;

    const serviceConfig = await loadApiFields(
      'google.cloud.kms.v1',
      storage,
      repositoryFileCache
    );

    assert.deepEqual(serviceConfig, {
      api_short_name: 'kms',
      documentation_uri: 'thing2',
      launch_stage: 'thing3',
      github_label: 'thing4',
    });
  });

  it('should load the appropriate API information from github and not drift, if service_config.yaml is not empty', async () => {
    const storage = {
      bucket: sinon.stub().returns({
        file: sinon.stub().returns({
          download: sinon
            .stub()
            .returns(
              '{"apis": [{"api_shortname": "kms", "display_name": "thing1", "docs_root_url": "thing2", "launch_stage": "thing3", "github_label": "thing4"}]}'
            ),
        }),
      }),
    } as unknown as Storage;

    const repositoryFileCache = {
      getFileContents: sinon.stub().returns({
        parsedContent:
          '{"api_short_name": "item1", "documentation_uri": "item2", "launch_stage": "item3", "github_label": "item4"}',
      }),
    } as unknown as RepositoryFileCache;

    const serviceConfig = await loadApiFields(
      'google.cloud.kms.v1',
      storage,
      repositoryFileCache
    );

    assert.deepStrictEqual(serviceConfig, {
      api_short_name: 'item1',
      documentation_uri: 'item2',
      launch_stage: 'item3',
      github_label: 'item4',
    });
  });

  it('should throw an error if service_config.yaml was not found', async () => {
    const storage = {
      bucket: sinon.stub().returns({
        file: sinon.stub().returns({
          download: sinon
            .stub()
            .returns(
              '{"apis": [{"api_shortname": "kms", "display_name": "thing1", "docs_root_url": "thing2", "launch_stage": "thing3", "github_label": "thing4"}]}'
            ),
        }),
      }),
    } as unknown as Storage;

    const repositoryFileCache = {
      getFileContents: sinon
        .stub()
        .returns(new FileNotFoundError('google/cloud/kms/v1/kms_v1.yaml')),
    } as unknown as RepositoryFileCache;

    assert.rejects(
      async () =>
        await loadApiFields('google.cloud.kms.v1', storage, repositoryFileCache)
    );
  });

  it('should throw an error if yaml was empty', async () => {
    const storage = {
      bucket: sinon.stub().returns({
        file: sinon.stub().returns({
          download: sinon
            .stub()
            .returns(
              '{"apis": [{"api_shortname": "kms", "display_name": "thing1", "docs_root_url": "thing2", "launch_stage": "thing3", "github_label": "thing4"}]}'
            ),
        }),
      }),
    } as unknown as Storage;

    const repositoryFileCache = {
      getFileContents: sinon.stub().returns({}),
    } as unknown as RepositoryFileCache;

    assert.rejects(
      async () =>
        await loadApiFields(
          'google.cloud.kms.v1',
          storage,
          repositoryFileCache
        ),
      /Service config not valid yaml or undefined/
    );
  });

  it('should return empty fields if neither the service config nor drift have info', async () => {
    const storage = {
      bucket: sinon.stub().returns({
        file: sinon.stub().returns({
          download: sinon
            .stub()
            .returns(
              '{"apis": [{"api_shortname": "kms", "display_name": "thing1", "docs_root_url": "thing2", "launch_stage": "thing3", "github_label": "thing4"}]}'
            ),
        }),
      }),
    } as unknown as Storage;

    const repositoryFileCache = {
      getFileContents: sinon.stub().returns({
        parsedContent: '{}',
      }),
    } as unknown as RepositoryFileCache;

    const serviceConfig = await loadApiFields(
      'google.cloud.accessapproval.v1',
      storage,
      repositoryFileCache
    );

    assert.deepStrictEqual(serviceConfig, {
      api_short_name: 'accessapproval',
      documentation_uri: '',
      launch_stage: 'LAUNCH_STAGE_UNSPECIFIED',
      github_label: '',
    });
  });
});
