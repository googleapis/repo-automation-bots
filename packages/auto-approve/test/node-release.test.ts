import {NodeRelease} from '../src/process-checks/node/release';
import {describe, it} from 'mocha';
import assert from 'assert';

describe('behavior of Node Release process', () => {
  it('should get constructed with the appropriate values', () => {
    const nodeRelease = new NodeRelease(
      'testAuthor',
      'testTitle',
      3,
      [{filename: 'hello', sha: '2345'}],
      'testRepoName',
      'testRepoOwner',
      1
    );

    const expectation = {
      incomingPR: {
        author: 'testAuthor',
        title: 'testTitle',
        fileCount: 3,
        changedFiles: [{filename: 'hello', sha: '2345'}],
        repoName: 'testRepoName',
        repoOwner: 'testRepoOwner',
        prNumber: 1,
      },
      classRule: {
        author: 'release-please',
        titleRegex: /^chore: release/,
        maxFiles: 2,
        fileNameRegex: [/^package.json$/, /^CHANGELOG.md$/],
        fileRules: [
          {
            targetFileToCheck: /^package.json$/,
            // This would match: -  "version": "2.3.0"
            oldVersion: new RegExp(
              /-[\s]*"(@?\S*)":[\s]"([0-9]*)*\.([0-9]*\.[0-9]*)",/
            ),
            // This would match: +  "version": "2.3.0"
            newVersion: new RegExp(
              /\+[\s]*"(@?\S*)":[\s]"([0-9]*)*\.([0-9]*\.[0-9]*)",/
            ),
          },
        ],
      },
    };

    assert.deepStrictEqual(nodeRelease.incomingPR, expectation.incomingPR);
    assert.deepStrictEqual(nodeRelease.classRule, expectation.classRule);
  });

  it('should return false in checkPR if incoming PR does not match classRules', () => {
    const nodeRelease = new NodeRelease(
      'testAuthor',
      'testTitle',
      3,
      [{filename: 'hello', sha: '2345'}],
      'testRepoName',
      'testRepoOwner',
      1
    );

    assert.deepStrictEqual(nodeRelease.checkPR(), false);
  });

  it('should return false in checkPR if one of the files does not match regular expression for permitted files', () => {
    const nodeRelease = new NodeRelease(
      'release-please',
      'fix(deps): update dependency mocha to v16',
      3,
      [
        {
          sha: '1349c83bf3c20b102da7ce85ebd384e0822354f3',
          filename: 'package.json',
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
        },
        {
          sha: '1349c83bf3c20b102da7ce85ebd384e0822354f3',
          filename: 'maliciousFile',
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
        },
      ],
      'testRepoName',
      'testRepoOwner',
      1
    );

    assert.deepStrictEqual(nodeRelease.checkPR(), false);
  });

  it('should return true in checkPR if incoming PR does match ONE OF the classRules, and no files do not match ANY of the rules', () => {
    const nodeRelease = new NodeRelease(
      'release-please',
      'chore: release 2.3.1',
      1,
      [
        {
          sha: '1349c83bf3c20b102da7ce85ebd384e0822354f3',
          filename: 'package.json',
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
        },
      ],
      'testRepoName',
      'testRepoOwner',
      1
    );

    assert.ok(nodeRelease.checkPR());
  });
});
