// Copyright 2024 Google LLC
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
import snapshot from 'snap-shot-it';
import assert from 'assert';
import {buildComment} from '../src/comments';
import {ConfigurationOptions} from '../src/config';

describe('buildComment', () => {
  it('skips if there are no annotations', () => {
    const configuration: ConfigurationOptions = {
      annotations: [],
    };
    const comment = buildComment(configuration);
    assert.strictEqual(comment, undefined);
  });
  it('should build instructions for a label', () => {
    const configuration: ConfigurationOptions = {
      annotations: [{type: 'label', text: 'kokoro: run'}],
    };
    const comment = buildComment(configuration);
    assert.ok(comment);
    snapshot(comment);
  });
  it('should build instructions for a comment', () => {
    const configuration: ConfigurationOptions = {
      annotations: [{type: 'comment', text: '/gcbrun'}],
    };
    const comment = buildComment(configuration);
    assert.ok(comment);
    snapshot(comment);
  });
  it('should build instructions for 2 things', () => {
    const configuration: ConfigurationOptions = {
      annotations: [
        {type: 'label', text: 'kokoro: run'},
        {type: 'comment', text: '/gcbrun'},
      ],
    };
    const comment = buildComment(configuration);
    assert.ok(comment);
    snapshot(comment);
  });
  it('should build instructions for 3 things', () => {
    const configuration: ConfigurationOptions = {
      annotations: [
        {type: 'label', text: 'kokoro: run'},
        {type: 'label', text: 'kokoro: force-run'},
        {type: 'comment', text: '/gcbrun'},
      ],
    };
    const comment = buildComment(configuration);
    assert.ok(comment);
    snapshot(comment);
  });
  it('should build instructions for multiple things as array', () => {
    const configuration: ConfigurationOptions = {
      annotations: [
        {type: 'label', text: ['kokoro: run', 'kokoro: force-run']},
        {type: 'comment', text: '/gcbrun'},
      ],
    };
    const comment = buildComment(configuration);
    assert.ok(comment);
    snapshot(comment);
  });
});
