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

import {resolve} from 'path';
import fs from 'fs';
import assert from 'assert';
import {describe, it} from 'mocha';

import {detectLicenseHeader} from '../src/header-parser';

const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('detectLicenseHeader', () => {
  it('should handle reference mit header', async () => {
    const contents = fs.readFileSync(
      resolve(fixturesPath, './mit-header.txt'),
      'utf-8'
    );
    const header = detectLicenseHeader(contents);
    assert.strictEqual(header.copyright, 'Google LLC');
    assert.strictEqual(header.year, 2020);
    assert.strictEqual(header.type, 'MIT');
  });

  it('should handle c-style comments', async () => {
    const contents = fs.readFileSync(
      resolve(fixturesPath, './c-style-header.txt'),
      'utf-8'
    );
    const header = detectLicenseHeader(contents);
    assert.strictEqual(header.copyright, 'Google LLC');
    assert.strictEqual(header.year, 2019);
    assert.strictEqual(header.type, 'Apache-2.0');
  });

  it('should handle c-style all rights reserved comments', async () => {
    const contents = fs.readFileSync(
      resolve(fixturesPath, './c-style-header-all-rights.txt'),
      'utf-8'
    );
    const header = detectLicenseHeader(contents);
    assert.strictEqual(header.copyright, 'Google LLC');
    assert.strictEqual(header.year, 2019);
    assert.strictEqual(header.type, 'Apache-2.0');
  });

  it('should handle bash-style comments', async () => {
    const contents = fs.readFileSync(
      resolve(fixturesPath, './bash-style-header.txt'),
      'utf-8'
    );
    const header = detectLicenseHeader(contents);
    assert.strictEqual(header.copyright, 'Google LLC');
    assert.strictEqual(header.year, 2019);
    assert.strictEqual(header.type, 'Apache-2.0');
  });

  it('should handle a copyright line with Google, Inc', async () => {
    const contents = fs.readFileSync(
      resolve(fixturesPath, './google-inc.txt'),
      'utf-8'
    );
    const header = detectLicenseHeader(contents);
    assert.strictEqual(header.copyright, 'Google, Inc');
    assert.strictEqual(header.year, 2016);
    assert.strictEqual(header.type, 'Apache-2.0');
  });

  it('should handle inline java-style comments', async () => {
    const contents = fs.readFileSync(
      resolve(fixturesPath, './inline-java-style-header.txt'),
      'utf-8'
    );
    const header = detectLicenseHeader(contents);
    assert.strictEqual(header.copyright, 'Google LLC');
    assert.strictEqual(header.year, 2019);
    assert.strictEqual(header.type, 'Apache-2.0');
  });

  it('should handle inline java-style comments with date ranges', async () => {
    const contents = fs.readFileSync(
      resolve(fixturesPath, './inline-java-style-header-date-range.txt'),
      'utf-8'
    );
    const header = detectLicenseHeader(contents);
    assert.strictEqual(header.copyright, 'Google LLC');
    assert.strictEqual(header.year, 2020);
    assert.strictEqual(header.type, 'Apache-2.0');
  });
});
