// Copyright 2020 Google LLC
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
import {buildHeader} from '../src/header-suggester';
import {HeaderType, LicenseType} from '../src/types';
import {resolve} from 'path';
import {readFileSync} from 'fs';
import * as assert from 'assert';

const fixturesPath = resolve(__dirname, '../../test/fixtures/headers');

function assertSameContent(value: string, expected: string) {
  const valueLines = value.split('\n');
  const expectedLines = expected.split('\n');
  assert.equal(valueLines.length, expectedLines.length);
  for (let i = 0; i < valueLines.length; i++) {
    assert.equal(valueLines[i], expectedLines[i]);
  }
}

describe('buildHeader', () => {
  describe('Apache 2.0 headers', () => {
    const licenseType: LicenseType = 'Apache-2.0';
    it('should handle hash type headers', async () => {
      const header = buildHeader(
        licenseType,
        HeaderType.HASH,
        'My Company',
        '1234'
      );
      const expected = readFileSync(
        resolve(fixturesPath, 'apache-hash.txt'),
        'utf-8'
      );
      assertSameContent(header, expected);
    });
    it('should handle slash type headers', async () => {
      const header = buildHeader(
        licenseType,
        HeaderType.SLASHES,
        'My Company',
        '1234'
      );
      const expected = readFileSync(
        resolve(fixturesPath, 'apache-slashes.txt'),
        'utf-8'
      );
      assertSameContent(header, expected);
    });
    it('should handle block type headers', async () => {
      const header = buildHeader(
        licenseType,
        HeaderType.BLOCK,
        'My Company',
        '1234'
      );
      const expected = readFileSync(
        resolve(fixturesPath, 'apache-block.txt'),
        'utf-8'
      );
      assertSameContent(header, expected);
    });
  });

  describe('BSD 3-clause headers', () => {
    const licenseType: LicenseType = 'BSD-3';
    it('should handle hash type headers', async () => {
      const header = buildHeader(
        licenseType,
        HeaderType.HASH,
        'My Company',
        '1234'
      );
      const expected = readFileSync(
        resolve(fixturesPath, 'bsd-hash.txt'),
        'utf-8'
      );
      assertSameContent(header, expected);
    });
    it('should handle slash type headers', async () => {
      const header = buildHeader(
        licenseType,
        HeaderType.SLASHES,
        'My Company',
        '1234'
      );
      const expected = readFileSync(
        resolve(fixturesPath, 'bsd-slashes.txt'),
        'utf-8'
      );
      assertSameContent(header, expected);
    });
    it('should handle block type headers', async () => {
      const header = buildHeader(
        licenseType,
        HeaderType.BLOCK,
        'My Company',
        '1234'
      );
      const expected = readFileSync(
        resolve(fixturesPath, 'bsd-block.txt'),
        'utf-8'
      );
      assertSameContent(header, expected);
    });
  });

  describe('MIT headers', () => {
    const licenseType: LicenseType = 'MIT';
    it('should handle hash type headers', async () => {
      const header = buildHeader(
        licenseType,
        HeaderType.HASH,
        'My Company',
        '1234'
      );
      const expected = readFileSync(
        resolve(fixturesPath, 'mit-hash.txt'),
        'utf-8'
      );
      assertSameContent(header, expected);
    });
    it('should handle slash type headers', async () => {
      const header = buildHeader(
        licenseType,
        HeaderType.SLASHES,
        'My Company',
        '1234'
      );
      const expected = readFileSync(
        resolve(fixturesPath, 'mit-slashes.txt'),
        'utf-8'
      );
      assertSameContent(header, expected);
    });
    it('should handle block type headers', async () => {
      const header = buildHeader(
        licenseType,
        HeaderType.BLOCK,
        'My Company',
        '1234'
      );
      const expected = readFileSync(
        resolve(fixturesPath, 'mit-block.txt'),
        'utf-8'
      );
      assertSameContent(header, expected);
    });
  });
});
