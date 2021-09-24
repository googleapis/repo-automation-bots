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
//

/* eslint-disable @typescript-eslint/no-var-requires */

import {Configuration, DEFAULT_CONFIGURATION} from '../src//configuration';
import {
  checkProductPrefixViolations,
  checkRemovingUsedTagViolations,
  Violation,
} from '../src/violations';
import {
  ChangesInPullRequest,
  RegionTagLocation,
  ParseResult,
} from '../src/region-tag-parser';

import * as snippetsModule from '../src/snippets';
import {Snippets} from '../src/snippets';
import {ApiLabels} from '../src/api-labels';
import * as apiLabelsModule from '../src/api-labels';
import {resolve} from 'path';
import assert from 'assert';
import {describe, it} from 'mocha';
import * as sinon from 'sinon';

const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('checkProductPrefixViolations', async () => {
  const loc: RegionTagLocation = {
    type: 'add',
    regionTag: 'run_hello',
    owner: 'owner',
    repo: 'repo',
    file: 'file',
    sha: 'sha',
    line: 42,
  };
  const loc2: RegionTagLocation = {
    type: 'add',
    regionTag: 'run_generated_hello',
    owner: 'owner',
    repo: 'repo',
    file: 'file',
    sha: 'sha',
    line: 42,
  };
  const changes1: ChangesInPullRequest = {
    changes: [loc],
    added: 1,
    deleted: 0,
    files: ['file'],
  };
  const changes2: ChangesInPullRequest = {
    changes: [loc2],
    added: 1,
    deleted: 0,
    files: ['file'],
  };
  const config: Configuration = new Configuration({...DEFAULT_CONFIGURATION});

  let getApiLabelsStub: sinon.SinonStub<[string], Promise<ApiLabels>>;

  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  beforeEach(() => {
    const apiLabels = require(resolve(
      fixturesPath,
      './violations-test-apiLabels'
    ));
    getApiLabelsStub = sandbox.stub(apiLabelsModule, 'getApiLabels');
    getApiLabelsStub.resolves(apiLabels);
  });
  it('should warn missing region_tag_prefix', async () => {
    const result = await checkProductPrefixViolations(changes1, config);
    assert(result.length === 1);
  });
  it('should allow api_shortname for samplegen', async () => {
    const result = await checkProductPrefixViolations(changes2, config);
    assert(result.length === 0);
  });
});

describe('checkRemovingUsedTagViolations', () => {
  const loc: RegionTagLocation = {
    type: 'del',
    regionTag: 'tag',
    owner: 'owner',
    repo: 'repo',
    file: 'file',
    sha: 'sha',
    line: 42,
  };
  const loc2: RegionTagLocation = {
    type: 'del',
    regionTag: 'tag2',
    owner: 'owner',
    repo: 'repo',
    file: 'file',
    sha: 'sha',
    line: 69,
  };
  const changes: ChangesInPullRequest = {
    changes: [loc, loc2],
    added: 0,
    deleted: 2,
    files: ['file'],
  };

  const config: Configuration = new Configuration({...DEFAULT_CONFIGURATION});

  let getSnippetsStub: sinon.SinonStub<[string], Promise<Snippets>>;

  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });
  it('should detect removals of used region tags', async () => {
    const snippets = require(resolve(
      fixturesPath,
      './violations-test-snippets'
    ));
    getSnippetsStub = sandbox.stub(snippetsModule, 'getSnippets');
    getSnippetsStub.resolves(snippets);

    const result = await checkRemovingUsedTagViolations(
      changes,
      config,
      new Map<string, ParseResult>(),
      'owner/repo',
      'main'
    );
    const removeUsedTagViolations = result.get(
      'REMOVE_USED_TAG'
    ) as Violation[];
    const removeConflictingTagViolations = result.get(
      'REMOVE_CONFLICTING_TAG'
    ) as Violation[];
    const removeSampleBrowserViolations = result.get(
      'REMOVE_SAMPLE_BROWSER_PAGE'
    ) as Violation[];
    const removeFrozenRegionTagViolations = result.get(
      'REMOVE_FROZEN_REGION_TAG'
    ) as Violation[];

    // Expecting we have 1 element in each result.
    assert(removeUsedTagViolations.length === 1);
    assert(removeConflictingTagViolations.length === 1);
    assert(removeSampleBrowserViolations.length === 1);
    assert(removeFrozenRegionTagViolations.length === 1);
  });
});
