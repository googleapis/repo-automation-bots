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
  formatBody,
  formatExpandable,
  formatRegionTag,
  formatViolations,
  formatMatchingViolation,
  MAX_CHARS_IN_CHECK_TEXT,
  OVERFLOW_FOOTER,
  maybeTrimText,
  CheckAggregator,
  Conclusion,
} from '../src/utils';
import {Violation} from '../src/violations';

import {RegionTagLocation} from '../src/region-tag-parser';

// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';

import assert from 'assert';
import {describe, it} from 'mocha';
import * as sinon from 'sinon';

const loc: RegionTagLocation = {
  type: 'add',
  regionTag: 'tag',
  owner: 'owner',
  repo: 'repo',
  file: 'file',
  sha: 'sha',
  line: 42,
};
const fetch = require('node-fetch');

describe('formatBody', () => {
  const commentMark = '<!-- commentMark>';
  const originalBody = 'original body';
  const shouldBeTrimmed = 'should be trimmed';
  const addition = 'addition';
  it('should format the body with the commentMark', () => {
    const result = formatBody(
      `${originalBody}${commentMark}${shouldBeTrimmed}`,
      commentMark,
      addition
    );
    assert(result.includes(originalBody));
    assert(result.includes(commentMark));
    assert(result.includes(addition));
    assert(!result.includes(shouldBeTrimmed));
    // A link to our issue page.
    assert(
      result.includes(
        'https://github.com/googleapis/repo-automation-bots/issues'
      )
    );
  });
  it('should add contents to an empty body', () => {
    const result = formatBody(
      undefined as unknown as string,
      commentMark,
      addition
    );
    assert(result.includes(addition));
    assert(
      result.includes(
        'https://github.com/googleapis/repo-automation-bots/issues'
      )
    );
    // It should start with the commentMark.
    assert(result.indexOf(commentMark) === 0);
  });
});

describe('formatExpandable', () => {
  it('should format as an expandable component in the UI', () => {
    const result = formatExpandable('summary', 'detail');
    assert(result.includes('<summary>summary</summary>'));
    assert(result.includes('detail\n</details>'));
  });
});

describe('formatRegionTag', () => {
  it('should format a RegionTagLocation with a link', () => {
    const result = formatRegionTag(loc);
    assert(result.includes('https://github.com/owner/repo/blob/sha/file#L42'));
    assert(result.includes('[file:42]'));
    assert(result.includes('tag'));
  });
});

describe('formatViolations', () => {
  it('should format an array of Violation', () => {
    const violations = new Array<Violation>();
    violations.push({
      location: loc,
      violationType: 'REMOVE_USED_TAG',
      devsite_urls: ['https://example.com/example.html'],
    });
    const result = formatViolations(violations, 'summary of violations');
    assert(result.includes('summary of violations'));
    assert(result.includes('https://example.com/example.html'));
  });
});

describe('formatMatchingViolation', () => {
  it('should report not having a matching start tag', () => {
    const violation: Violation = {
      location: loc,
      violationType: 'NO_MATCHING_START_TAG',
      devsite_urls: ['https://example.com/example.html'],
    };
    const result = formatMatchingViolation(violation);
    assert(result.includes("doesn't have a matching start tag."));
  });
  it('should report not having a matching end tag', () => {
    const violation: Violation = {
      location: loc,
      violationType: 'NO_MATCHING_END_TAG',
      devsite_urls: ['https://example.com/example.html'],
    };
    const result = formatMatchingViolation(violation);
    assert(result.includes("doesn't have a matching end tag."));
  });
  it('should report the tag is already started', () => {
    const violation: Violation = {
      location: loc,
      violationType: 'TAG_ALREADY_STARTED',
      devsite_urls: ['https://example.com/example.html'],
    };
    const result = formatMatchingViolation(violation);
    assert(result.includes('already started.'));
  });
});

describe('maybeTrimText', () => {
  it('should trim a long text', () => {
    let longText = '';
    for (let i = 0; i < MAX_CHARS_IN_CHECK_TEXT + 10; i++) {
      longText += 'a';
    }
    const newText = maybeTrimText(longText);
    assert(newText.length === MAX_CHARS_IN_CHECK_TEXT);
  });
  it('should trim a long text with a `details` tag', () => {
    const details = '<details>\n<summary>sum</summary>det\n</details>\n';
    let longText = details;
    for (let i = 0; i < MAX_CHARS_IN_CHECK_TEXT; i++) {
      longText += 'a';
    }
    const newText = maybeTrimText(longText);
    console.log(newText);
    // The new text should be cut at the end of the details.
    assert(newText === `${details}${OVERFLOW_FOOTER}`);
  });
});

describe('CheckAggregator', () => {
  const octokit = new Octokit({request: {fetch}});
  const sandbox = sinon.createSandbox();
  let checksCreateStub: sinon.SinonStub;
  beforeEach(() => {
    checksCreateStub = sandbox.stub(octokit.checks, 'create');
  });
  afterEach(() => {
    sandbox.restore();
  });
  it('should trim the text of an individual check param', () => {
    let longText = '';
    for (let i = 0; i < MAX_CHARS_IN_CHECK_TEXT + 10; i++) {
      longText += 'a';
    }
    const aggregator = new CheckAggregator(octokit, 'title', false);
    const checkParam = {
      owner: 'owner',
      repo: 'repo',
      name: 'Mismatched region tag',
      conclusion: 'success' as Conclusion,
      head_sha: 'sha',
      output: {
        title: 'Region tag check',
        summary: 'Region tag successful',
        text: longText,
      },
    };
    aggregator.add(checkParam);
    aggregator.submit();
    sinon.assert.calledOnce(checksCreateStub);
    const args = checksCreateStub.getCalls()[0].args;
    assert(args[0].output.text);
    assert(args[0].output!.text.length <= MAX_CHARS_IN_CHECK_TEXT);
  });
  it('should trim the text of the aggregated check params', () => {
    let longText = '';
    for (let i = 0; i < MAX_CHARS_IN_CHECK_TEXT + 10; i++) {
      longText += 'a';
    }
    const aggregator = new CheckAggregator(octokit, 'title', true);
    const checkParam = {
      owner: 'owner',
      repo: 'repo',
      name: 'Mismatched region tag',
      conclusion: 'success' as Conclusion,
      head_sha: 'sha',
      output: {
        title: 'Region tag check',
        summary: 'Region tag successful',
        text: longText,
      },
    };
    aggregator.add(checkParam);
    aggregator.add(checkParam);
    aggregator.submit();
    sinon.assert.calledOnce(checksCreateStub);
    const args = checksCreateStub.getCalls()[0].args;
    assert(args[0].output.text);
    assert(args[0].output!.text.length <= MAX_CHARS_IN_CHECK_TEXT);
  });
});
