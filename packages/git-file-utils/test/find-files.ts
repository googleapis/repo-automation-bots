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

import nock from 'nock';
import {expect} from 'chai';
import {describe, it} from 'mocha';
import {Octokit} from '@octokit/rest';
import {resolve} from 'path';
import {BranchFileCache} from '../src/git-file-utils';
const fetch = require('node-fetch');

nock.disableNetConnect();

const octokit = new Octokit({
  auth: 'sometoken',
  request: {
    fetch,
  },
});
const fixturesPath = './test/fixtures';

describe('BranchFileCache', () => {
  let cache: BranchFileCache;
  beforeEach(() => {
    cache = new BranchFileCache(
      octokit,
      {owner: 'testOwner', repo: 'testRepo'},
      'feature-branch'
    );
  });

  describe('findFilesByFilename', () => {
    describe('with small repository', () => {
      let req: nock.Scope;
      beforeEach(() => {
        req = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/git/trees/feature-branch?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-recursive'
            ))
          );
      });
      it('finds multiple files', async () => {
        const files = await cache.findFilesByFilename('foo.json');
        expect(files).lengthOf(2);
        expect(files).to.eql(['pkg/a/foo.json', 'pkg/b/foo.json']);
        req.done();
      });

      it('finds multiple files and strips prefix', async () => {
        const files = await cache.findFilesByFilename('foo.json', 'pkg');
        expect(files).lengthOf(2);
        expect(files).to.eql(['a/foo.json', 'b/foo.json']);
        req.done();
      });

      it('finds multiple files filtered by prefix', async () => {
        const files = await cache.findFilesByFilename('foo.json', 'pkg/b');
        expect(files).lengthOf(1);
        expect(files).to.eql(['foo.json']);
        req.done();
      });
    });
    describe('with large repository', () => {
      it('finds multiple files', async () => {
        const req = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/git/trees/feature-branch?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-truncated'
            ))
          )
          .get('/repos/testOwner/testRepo/git/trees/feature-branch')
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/cc64165cf5da91810ab7edc1143a47be42513c0a?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg-recursive'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/0ab7edc1143a47be42513c0acc64165cf5da9181?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-subdir1'
            ))
          );
        const files = await cache.findFilesByFilename('foo.json');
        expect(files).lengthOf(2);
        expect(files).to.eql(['pkg/a/foo.json', 'pkg/b/foo.json']);
        req.done();
      });

      it('finds multiple files recursively with truncated trees', async () => {
        const req = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/git/trees/feature-branch?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-truncated'
            ))
          )
          .get('/repos/testOwner/testRepo/git/trees/feature-branch')
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/cc64165cf5da91810ab7edc1143a47be42513c0a?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg-truncated'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/cc64165cf5da91810ab7edc1143a47be42513c0a'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/0ab7edc1143a47be42513c0acc64165cf5da9181?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-subdir1'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/1143a47be42513c0acc64165cf5da91810ab7edc?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg-a'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/0acc64165cf5da91810ab7edc1143a47be42513c?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg-b'
            ))
          );
        const files = await cache.findFilesByFilename('foo.json');
        expect(files).lengthOf(2);
        expect(files).to.eql(['pkg/a/foo.json', 'pkg/b/foo.json']);
        req.done();
      });

      it('finds multiple files and strips prefix', async () => {
        const req = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/git/trees/feature-branch?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-truncated'
            ))
          )
          .get('/repos/testOwner/testRepo/git/trees/feature-branch')
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/cc64165cf5da91810ab7edc1143a47be42513c0a?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg-truncated'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/cc64165cf5da91810ab7edc1143a47be42513c0a'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/1143a47be42513c0acc64165cf5da91810ab7edc?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg-a'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/0acc64165cf5da91810ab7edc1143a47be42513c?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg-b'
            ))
          );
        const files = await cache.findFilesByFilename('foo.json', 'pkg');
        expect(files).lengthOf(2);
        expect(files).to.eql(['a/foo.json', 'b/foo.json']);
        req.done();
      });

      it('finds and strips prefix', async () => {
        const req = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/git/trees/feature-branch?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-truncated'
            ))
          )
          .get('/repos/testOwner/testRepo/git/trees/feature-branch')
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/cc64165cf5da91810ab7edc1143a47be42513c0a?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg-truncated'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/cc64165cf5da91810ab7edc1143a47be42513c0a'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/0acc64165cf5da91810ab7edc1143a47be42513c?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg-b'
            ))
          );
        const files = await cache.findFilesByFilename('foo.json', 'pkg/b');
        expect(files).lengthOf(1);
        expect(files).to.eql(['foo.json']);
        req.done();
      });
    });
  });

  describe('findFilesByExtension', () => {
    describe('with small repository', () => {
      let req: nock.Scope;
      beforeEach(() => {
        req = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/git/trees/feature-branch?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-recursive'
            ))
          );
      });
      it('finds multiple files', async () => {
        const files = await cache.findFilesByExtension('json');
        expect(files).lengthOf(3);
        expect(files).to.eql([
          'pkg/a/foo.json',
          'pkg/b/foo.json',
          'package.json',
        ]);
        req.done();
      });

      it('finds multiple files and strips prefix', async () => {
        const files = await cache.findFilesByExtension('json', 'pkg');
        expect(files).lengthOf(2);
        expect(files).to.eql(['a/foo.json', 'b/foo.json']);
        req.done();
      });

      it('finds multiple files filtered by prefix', async () => {
        const files = await cache.findFilesByExtension('json', 'pkg/b');
        expect(files).lengthOf(1);
        expect(files).to.eql(['foo.json']);
        req.done();
      });
    });
    describe('with large repository', () => {
      it('finds multiple files', async () => {
        const req = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/git/trees/feature-branch?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-truncated'
            ))
          )
          .get('/repos/testOwner/testRepo/git/trees/feature-branch')
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/cc64165cf5da91810ab7edc1143a47be42513c0a?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg-recursive'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/0ab7edc1143a47be42513c0acc64165cf5da9181?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-subdir1'
            ))
          );
        const files = await cache.findFilesByExtension('json');
        expect(files).lengthOf(4);
        expect(files).to.eql([
          'package-lock.json',
          'package.json',
          'pkg/a/foo.json',
          'pkg/b/foo.json',
        ]);
        req.done();
      });

      it('finds multiple files recursively with truncated trees', async () => {
        const req = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/git/trees/feature-branch?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-truncated'
            ))
          )
          .get('/repos/testOwner/testRepo/git/trees/feature-branch')
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/cc64165cf5da91810ab7edc1143a47be42513c0a?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg-truncated'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/cc64165cf5da91810ab7edc1143a47be42513c0a'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/0ab7edc1143a47be42513c0acc64165cf5da9181?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-subdir1'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/1143a47be42513c0acc64165cf5da91810ab7edc?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg-a'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/0acc64165cf5da91810ab7edc1143a47be42513c?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg-b'
            ))
          );
        const files = await cache.findFilesByExtension('json');
        expect(files).lengthOf(4);
        expect(files).to.eql([
          'package-lock.json',
          'package.json',
          'pkg/a/foo.json',
          'pkg/b/foo.json',
        ]);
        req.done();
      });

      it('finds multiple files and strips prefix', async () => {
        const req = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/git/trees/feature-branch?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-truncated'
            ))
          )
          .get('/repos/testOwner/testRepo/git/trees/feature-branch')
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/cc64165cf5da91810ab7edc1143a47be42513c0a?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg-truncated'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/cc64165cf5da91810ab7edc1143a47be42513c0a'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/1143a47be42513c0acc64165cf5da91810ab7edc?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg-a'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/0acc64165cf5da91810ab7edc1143a47be42513c?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg-b'
            ))
          );
        const files = await cache.findFilesByExtension('json', 'pkg');
        expect(files).lengthOf(2);
        expect(files).to.eql(['a/foo.json', 'b/foo.json']);
        req.done();
      });

      it('finds multiple files and strips prefix', async () => {
        const req = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/git/trees/feature-branch?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-truncated'
            ))
          )
          .get('/repos/testOwner/testRepo/git/trees/feature-branch')
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/cc64165cf5da91810ab7edc1143a47be42513c0a?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg-truncated'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/cc64165cf5da91810ab7edc1143a47be42513c0a'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/0acc64165cf5da91810ab7edc1143a47be42513c?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg-b'
            ))
          );
        const files = await cache.findFilesByExtension('json', 'pkg/b');
        expect(files).lengthOf(1);
        expect(files).to.eql(['foo.json']);
        req.done();
      });
    });
  });

  describe('findFilesByGlob', () => {
    describe('with small repository', () => {
      let req: nock.Scope;
      beforeEach(() => {
        req = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/git/trees/feature-branch?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-recursive'
            ))
          );
      });
      it('finds multiple files', async () => {
        const files = await cache.findFilesByGlob('**/*.json');
        expect(files).lengthOf(3);
        expect(files).to.eql([
          'pkg/a/foo.json',
          'pkg/b/foo.json',
          'package.json',
        ]);
        req.done();
      });

      it('finds multiple files and strips prefix', async () => {
        const files = await cache.findFilesByGlob('**/*.json', 'pkg');
        expect(files).lengthOf(2);
        expect(files).to.eql(['a/foo.json', 'b/foo.json']);
        req.done();
      });

      it('finds multiple files filtered by prefix', async () => {
        const files = await cache.findFilesByGlob('**/*.json', 'pkg/b');
        expect(files).lengthOf(1);
        expect(files).to.eql(['foo.json']);
        req.done();
      });
    });
    describe('with large repository', () => {
      it('finds multiple files', async () => {
        const req = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/git/trees/feature-branch?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-truncated'
            ))
          )
          .get('/repos/testOwner/testRepo/git/trees/feature-branch')
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/cc64165cf5da91810ab7edc1143a47be42513c0a?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg-recursive'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/0ab7edc1143a47be42513c0acc64165cf5da9181?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-subdir1'
            ))
          );
        const files = await cache.findFilesByGlob('**/*.json');
        expect(files).lengthOf(4);
        expect(files).to.eql([
          'package-lock.json',
          'package.json',
          'pkg/a/foo.json',
          'pkg/b/foo.json',
        ]);
        req.done();
      });

      it('finds multiple files recursively with truncated trees', async () => {
        const req = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/git/trees/feature-branch?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-truncated'
            ))
          )
          .get('/repos/testOwner/testRepo/git/trees/feature-branch')
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/cc64165cf5da91810ab7edc1143a47be42513c0a?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg-truncated'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/cc64165cf5da91810ab7edc1143a47be42513c0a'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/0ab7edc1143a47be42513c0acc64165cf5da9181?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-subdir1'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/1143a47be42513c0acc64165cf5da91810ab7edc?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg-a'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/0acc64165cf5da91810ab7edc1143a47be42513c?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg-b'
            ))
          );
        const files = await cache.findFilesByGlob('**/*.json');
        expect(files).lengthOf(4);
        expect(files).to.eql([
          'package-lock.json',
          'package.json',
          'pkg/a/foo.json',
          'pkg/b/foo.json',
        ]);
        req.done();
      });

      it('finds multiple files and strips prefix', async () => {
        const req = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/git/trees/feature-branch?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-truncated'
            ))
          )
          .get('/repos/testOwner/testRepo/git/trees/feature-branch')
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/cc64165cf5da91810ab7edc1143a47be42513c0a?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg-truncated'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/cc64165cf5da91810ab7edc1143a47be42513c0a'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/1143a47be42513c0acc64165cf5da91810ab7edc?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg-a'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/0acc64165cf5da91810ab7edc1143a47be42513c?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg-b'
            ))
          );
        const files = await cache.findFilesByGlob('**/*.json', 'pkg');
        expect(files).lengthOf(2);
        expect(files).to.eql(['a/foo.json', 'b/foo.json']);
        req.done();
      });

      it('finds multiple files and strips prefix', async () => {
        const req = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/git/trees/feature-branch?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-truncated'
            ))
          )
          .get('/repos/testOwner/testRepo/git/trees/feature-branch')
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/cc64165cf5da91810ab7edc1143a47be42513c0a?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg-truncated'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/cc64165cf5da91810ab7edc1143a47be42513c0a'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg'
            ))
          )
          .get(
            '/repos/testOwner/testRepo/git/trees/0acc64165cf5da91810ab7edc1143a47be42513c?recursive=true'
          )
          .reply(
            200,
            require(resolve(
              fixturesPath,
              'github-data-api/data-api-trees-successful-response-subdir-pkg-b'
            ))
          );
        const files = await cache.findFilesByGlob('**/*.json', 'pkg/b');
        expect(files).lengthOf(1);
        expect(files).to.eql(['foo.json']);
        req.done();
      });
    });
  });
});
