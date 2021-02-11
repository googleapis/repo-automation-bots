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

import {
  Configuration,
  DEFAULT_CONFIGURATION,
} from '../src//configuration';
import {
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
import {resolve} from 'path';
import assert from 'assert';
import {describe, it} from 'mocha';
import * as sinon from 'sinon';

const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('checkRemovingUsedTagViolations', () => {
  const loc: RegionTagLocation = {
    type: 'del',
    regionTag: 'tag',
    owner: 'owner',
    repo: 'repo',
    file: 'file',
    sha: 'sha',
    line: 42
  };
  const loc2: RegionTagLocation = {
    type: 'del',
    regionTag: 'tag2',
    owner: 'owner',
    repo: 'repo',
    file: 'file',
    sha: 'sha',
    line: 69
  };
  const changes: ChangesInPullRequest = {
    changes: [loc, loc2],
    added: 0,
    deleted: 2,
    files: ['file']
  }

  const config: Configuration = new Configuration({...DEFAULT_CONFIGURATION});

  let getSnippetsStub: sinon.SinonStub<[string], Promise<Snippets>>;

  const sandbox = sinon.createSandbox();

  afterEach(() => {
    sandbox.restore();
  });
  it('should detect removals of used region tags', async () => {
    const snippets = require(resolve(fixturesPath, './violations-test-snippets'));
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
    assert(removeUsedTagViolations.length == 1);
    assert(removeConflictingTagViolations.length == 1);
    assert(removeSampleBrowserViolations.length == 1);
    assert(removeFrozenRegionTagViolations.length == 1);
  });
});
