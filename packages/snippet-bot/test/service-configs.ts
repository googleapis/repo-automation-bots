// Copyright 2023 Google LLC
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

import {afterEach, describe, it} from 'mocha';
/* eslint-disable node/no-extraneous-import */
import {Octokit} from '@octokit/rest';
import {scanServiceConfigsForApiLabels} from '../src/service-configs';
import {
  RepositoryFileCache,
  GitHubFileContents,
} from '@google-automations/git-file-utils';
import * as sinon from 'sinon';
import assert from 'assert';
import * as fs from 'fs';
import {resolve} from 'path';

const sandbox = sinon.createSandbox();
const fixturesPath = resolve(__dirname, '../../test/fixtures');
const fetch = require('node-fetch');

function fileContentsFromFixture(fixture: string): GitHubFileContents {
  return {
    sha: 'abc123',
    content: '',
    parsedContent: fs
      .readFileSync(resolve(fixturesPath, fixture))
      .toString('utf-8'),
    mode: '100644',
  };
}

describe('scanServiceConfigsForApiLabels', () => {
  afterEach(() => {
    sandbox.restore();
  });
  const octokit = new Octokit({auth: '123', request: {fetch}});
  it('should collect fields from service configs', async () => {
    sandbox
      .stub(RepositoryFileCache.prototype, 'findFilesByGlob')
      .resolves([
        'path1/foo_v1.yaml',
        'path2/bar_v2alpha.yaml',
        'path3/qwer_v3.yaml',
      ]);
    sandbox
      .stub(RepositoryFileCache.prototype, 'getFileContents')
      .withArgs('path1/foo_v1.yaml', 'master')
      .resolves(fileContentsFromFixture('service-config/foo_v1.yaml'))
      .withArgs('path2/bar_v2alpha.yaml', 'master')
      .resolves(fileContentsFromFixture('service-config/bar_v2alpha.yaml'))
      .withArgs('path3/qwer_v3.yaml', 'master')
      .resolves(fileContentsFromFixture('service-config/qwer_v3.yaml'));
    const apiLabels = await scanServiceConfigsForApiLabels(octokit);
    assert(apiLabels.products.length === 3);
  });

  it('ignores service configs without publishing', async () => {
    sandbox
      .stub(RepositoryFileCache.prototype, 'findFilesByGlob')
      .resolves([
        'path1/foo_v1.yaml',
        'path2/bar_v2alpha.yaml',
        'path3/qwer_v3.yaml',
      ]);
    sandbox
      .stub(RepositoryFileCache.prototype, 'getFileContents')
      .withArgs('path1/foo_v1.yaml', 'master')
      .resolves(fileContentsFromFixture('service-config/foo_v1.yaml'))
      .withArgs('path2/bar_v2alpha.yaml', 'master')
      .resolves(fileContentsFromFixture('service-config/bar_v2alpha.yaml'))
      .withArgs('path3/qwer_v3.yaml', 'master')
      .resolves(
        fileContentsFromFixture('service-config/no_publishing_v1.yaml')
      );
    const apiLabels = await scanServiceConfigsForApiLabels(octokit);
    assert(apiLabels.products.length === 2);
  });

  it('ignores service configs without doc_tag_prefix', async () => {
    sandbox
      .stub(RepositoryFileCache.prototype, 'findFilesByGlob')
      .resolves([
        'path1/foo_v1.yaml',
        'path2/bar_v2alpha.yaml',
        'path3/qwer_v3.yaml',
      ]);
    sandbox
      .stub(RepositoryFileCache.prototype, 'getFileContents')
      .withArgs('path1/foo_v1.yaml', 'master')
      .resolves(fileContentsFromFixture('service-config/foo_v1.yaml'))
      .withArgs('path2/bar_v2alpha.yaml', 'master')
      .resolves(fileContentsFromFixture('service-config/bar_v2alpha.yaml'))
      .withArgs('path3/qwer_v3.yaml', 'master')
      .resolves(
        fileContentsFromFixture('service-config/empty_doc_tag_prefix.yaml')
      );
    const apiLabels = await scanServiceConfigsForApiLabels(octokit);
    assert(apiLabels.products.length === 2);
  });

  it('ignores non-service yaml', async () => {
    sandbox
      .stub(RepositoryFileCache.prototype, 'findFilesByGlob')
      .resolves([
        'path1/foo_v1.yaml',
        'path2/bar_v2alpha.yaml',
        'path3/qwer_v3.yaml',
      ]);
    sandbox
      .stub(RepositoryFileCache.prototype, 'getFileContents')
      .withArgs('path1/foo_v1.yaml', 'master')
      .resolves(fileContentsFromFixture('service-config/foo_v1.yaml'))
      .withArgs('path2/bar_v2alpha.yaml', 'master')
      .resolves(fileContentsFromFixture('service-config/bar_v2alpha.yaml'))
      .withArgs('path3/qwer_v3.yaml', 'master')
      .resolves(fileContentsFromFixture('service-config/non_service.yaml'));
    const apiLabels = await scanServiceConfigsForApiLabels(octokit);
    assert(apiLabels.products.length === 2);
  });
});
