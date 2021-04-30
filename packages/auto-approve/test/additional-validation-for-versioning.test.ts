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
import {
  getTargetFile,
  getVersions,
  isMajorVersionChanging,
  isMinorVersionUpgraded,
  isOneDependencyChanged,
} from '../src/utils-for-PR-checking';
import {describe, it} from 'mocha';
import assert from 'assert';
import languageVersioningRules from '../src/language-versioning-rules.json';

const {Octokit} = require('@octokit/rest');

const octokit = new Octokit({
  auth: 'mypersonalaccesstoken123',
});

describe('run additional versioning checks', () => {
  describe('get target file tests', () => {
    it('should correctly identify the target file if it exists in the PR', async () => {
      const prFiles = [
        {
          filename: 'package.json',
          sha: '1234',
          additions: 1,
          deletions: 1,
          patch: 'patch',
        },
        {filename: 'filename2', sha: '5678'},
      ];
      const fileAndFileRuleExpectation = {
        file: {
          filename: 'package.json',
          sha: '1234',
          additions: 1,
          deletions: 1,
          patch: 'patch',
        },
        fileRule: {
          prAuthor: 'release-please[bot]',
          targetFile: 'package.json',
          oldRegexVersion:
            '-[\\s]*"version":[\\s]"([0-9]*)*\\.([0-9]*\\.[0-9]*)",',
          newRegexVersion:
            '\\+[\\s]*"version":[\\s]"([0-9]*)*\\.([0-9]*\\.[0-9]*)",',
        },
      };

      const fileAndFileRule = getTargetFile(
        prFiles,
        'release-please[bot]',
        languageVersioningRules
      );

      assert.deepStrictEqual(fileAndFileRule, fileAndFileRuleExpectation);
    });

    it('should return undefined if the file does not match any special rules', async () => {
      const prFiles = [
        {
          filename: 'packagy.json',
          sha: '1234',
          additions: 1,
          deletions: 1,
          patch: 'patch',
        },
        {filename: 'filename2', sha: '5678'},
      ];

      const fileAndFileRule = getTargetFile(
        prFiles,
        'release-please[bot]',
        languageVersioningRules
      );

      assert.deepStrictEqual(fileAndFileRule, undefined);
    });

    it('should return undefined if no match with PR author', async () => {
      const prFiles = [
        {
          filename: 'package.json',
          sha: '1234',
          additions: 1,
          deletions: 1,
          patch: 'patch',
        },
        {filename: 'filename2', sha: '5678'},
      ];

      const fileAndFileRule = getTargetFile(
        prFiles,
        'not-release-please-bot',
        languageVersioningRules
      );

      assert.deepStrictEqual(fileAndFileRule, undefined);
    });
  });

  describe('get versions from patch file', () => {
    it('should return the correct versions from a package.json file', () => {
      const PRFile = {
        sha: 'c9fadc5c8972d1c034a050eb6b1a6b79fcd67785',
        filename: 'package.json',
        status: 'modified',
        additions: 1,
        deletions: 1,
        changes: 2,
        patch:
          '@@ -1,7 +1,7 @@\n' +
          ' {\n' +
          '   "name": "@google-cloud/kms",\n' +
          '   "description": "Google Cloud Key Management Service (KMS) API client for Node.js",\n' +
          '-  "version": "2.3.0",\n' +
          '+  "version": "2.3.1",\n' +
          '   "license": "Apache-2.0",\n' +
          '   "author": "Google LLC",\n' +
          '   "engines": {',
      };

      const fileRule = {
        prAuthor: 'release-please[bot]',
        targetFile: 'package.json',
        oldRegexVersion:
          '-[\\s]*"version":[\\s]"([0-9]*)*\\.([0-9]*\\.[0-9]*)",',
        newRegexVersion:
          '\\+[\\s]*"version":[\\s]"([0-9]*)*\\.([0-9]*\\.[0-9]*)",',
      };

      const getVersionsExpectation = {
        oldMajorVersion: '2',
        oldMinorVersion: '3.0',
        newMajorVersion: '2',
        newMinorVersion: '3.1',
      };
      const versions = getVersions(
        PRFile,
        fileRule.oldRegexVersion,
        fileRule.newRegexVersion
      );

      assert.deepStrictEqual(versions, getVersionsExpectation);
    });

    it('should throw an error if it cannot find the proper versions', () => {
      const PRFile = {
        sha: 'c9fadc5c8972d1c034a050eb6b1a6b79fcd67785',
        filename: 'package.json',
        status: 'modified',
        additions: 1,
        deletions: 1,
        changes: 2,
        patch:
          '@@ -1,7 +1,7 @@\n' +
          ' {\n' +
          '   "name": "@google-cloud/kms",\n' +
          '   "description": "Google Cloud Key Management Service (KMS) API client for Node.js",\n' +
          '-  "NOT-THE-RIGHT-VERSION": "2.3.0",\n' +
          '+  "NOT-THE-RIGHT-VERSION": "2.3.1",\n' +
          '   "license": "Apache-2.0",\n' +
          '   "author": "Google LLC",\n' +
          '   "engines": {',
      };

      const fileRule = {
        prAuthor: 'release-please[bot]',
        targetFile: 'package.json',
        oldRegexVersion:
          '-[\\s]*"version":[\\s]"([0-9]*)*\\.([0-9]*\\.[0-9]*)",',
        newRegexVersion:
          '\\+[\\s]*"version":[\\s]"([0-9]*)*\\.([0-9]*\\.[0-9]*)",',
      };

      assert.throws(() => {
        getVersions(PRFile, fileRule.oldRegexVersion, fileRule.newRegexVersion);
      }, /Could not find versions in package.json\/c9fadc5c8972d1c034a050eb6b1a6b79fcd67785/);
    });

    it('should return undefined if the target file does not exist', () => {
      const fileRule = {
        prAuthor: 'release-please[bot]',
        targetFile: 'package.json',
        oldRegexVersion:
          '-[\\s]*"version":[\\s]"([0-9]*)*\\.([0-9]*\\.[0-9]*)",',
        newRegexVersion:
          '\\+[\\s]*"version":[\\s]"([0-9]*)*\\.([0-9]*\\.[0-9]*)",',
      };

      assert.strictEqual(
        getVersions(
          undefined,
          fileRule.oldRegexVersion,
          fileRule.newRegexVersion
        ),
        undefined
      );
    });
  });

  describe('decide whether major is bumped', () => {
    it('should return true if major version is changed', () => {
      const versions = {
        oldMajorVersion: '3',
        oldMinorVersion: '2.0',
        newMajorVersion: '4',
        newMinorVersion: '0.0',
      };

      assert.strictEqual(isMajorVersionChanging(versions), true);
    });

    it('should return false if major version was not changed', () => {
      const versions = {
        oldMajorVersion: '3',
        oldMinorVersion: '2.0',
        newMajorVersion: '3',
        newMinorVersion: '3.0',
      };

      assert.strictEqual(isMajorVersionChanging(versions), false);
    });
  });

  describe('decide whether minor is bumped', () => {
    it('should return true if minor version is upgraded', () => {
      const versions = {
        oldMajorVersion: '3',
        oldMinorVersion: '2.0',
        newMajorVersion: '4',
        newMinorVersion: '3.0',
      };

      assert.strictEqual(isMinorVersionUpgraded(versions), true);
    });

    it('should return false if minor version was not upgraded', () => {
      const versions = {
        oldMajorVersion: '3',
        oldMinorVersion: '2.0',
        newMajorVersion: '3',
        newMinorVersion: '2.0',
      };

      assert.strictEqual(isMinorVersionUpgraded(versions), false);
    });

    it('should return false if minor version was downgraded', () => {
      const versions = {
        oldMajorVersion: '3',
        oldMinorVersion: '2.0',
        newMajorVersion: '3',
        newMinorVersion: '1.0',
      };

      assert.strictEqual(isMinorVersionUpgraded(versions), false);
    });
  });

  describe('decide whether there was the wrong amount of changes', () => {
    it('should return true if there was only one change', () => {
      const PRFile = {
        sha: 'c9fadc5c8972d1c034a050eb6b1a6b79fcd67785',
        filename: 'package.json',
        status: 'modified',
        additions: 1,
        deletions: 1,
        changes: 2,
        patch:
          '@@ -1,7 +1,7 @@\n' +
          ' {\n' +
          '   "name": "@google-cloud/kms",\n' +
          '   "description": "Google Cloud Key Management Service (KMS) API client for Node.js",\n' +
          '-  "version": "2.3.0",\n' +
          '+  "version": "2.3.1",\n' +
          '   "license": "Apache-2.0",\n' +
          '   "author": "Google LLC",\n' +
          '   "engines": {',
      };

      assert.strictEqual(isOneDependencyChanged(PRFile), true);
    });

    it('should return false if more than one dependency was changed', () => {
      const PRFile = {
        sha: 'c9fadc5c8972d1c034a050eb6b1a6b79fcd67785',
        filename: 'package.json',
        status: 'modified',
        additions: 1,
        deletions: 1,
        changes: 3,
        patch:
          '@@ -1,7 +1,7 @@\n' +
          ' {\n' +
          '   "name": "@google-cloud/kms",\n' +
          '   "description": "Google Cloud Key Management Service (KMS) API client for Node.js",\n' +
          '-  "version": "2.3.0",\n' +
          '+  "version": "2.3.1",\n' +
          '   "license": "Apache-2.0",\n' +
          '   "author": "Google LLC",\n' +
          '   "engines": {',
      };

      assert.strictEqual(isOneDependencyChanged(PRFile), false);
    });

    it('should return false if there were more files changed', () => {
      const PRFile = {
        sha: 'c9fadc5c8972d1c034a050eb6b1a6b79fcd67785',
        filename: 'package.json',
        status: 'modified',
        additions: 2,
        deletions: 2,
        changes: 2,
        patch:
          '@@ -1,7 +1,7 @@\n' +
          ' {\n' +
          '   "name": "@google-cloud/kms",\n' +
          '   "description": "Google Cloud Key Management Service (KMS) API client for Node.js",\n' +
          '-  "version": "2.3.0",\n' +
          '+  "version": "2.3.1",\n' +
          '   "license": "Apache-2.0",\n' +
          '   "author": "Google LLC",\n' +
          '   "engines": {',
      };

      assert.strictEqual(isOneDependencyChanged(PRFile), false);
    });
  });
});
