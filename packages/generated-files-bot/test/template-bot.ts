// Copyright 2020 Google LLC
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

import {resolve} from 'path';
import {Probot, createProbot, ProbotOctokit} from 'probot';
import nock from 'nock';
import * as fs from 'fs';
import snapshot from 'snap-shot-it';
import {expect} from 'chai';
import {describe, it, beforeEach} from 'mocha';
import {
  parseManifest,
  getFileList,
  Configuration,
  getPullRequestFiles,
  buildCommentMessage,
  handler,
} from '../src/generated-files-bot';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');
const jsonManifest = fs
  .readFileSync(resolve(fixturesPath, 'manifests', 'simple.json'))
  .toString();
const yamlManifest = fs
  .readFileSync(resolve(fixturesPath, 'manifests', 'simple.yaml'))
  .toString();

describe('generated-files-bot', () => {
  let requests: nock.Scope;

  beforeEach(() => {
    requests = nock('https://api.github.com');
  });

  describe('parseManifest', () => {
    describe('json input', () => {
      it('should parse a simple jsonpath', () => {
        const values = parseManifest(jsonManifest, 'json', '$.key1[*]');
        expect(values).to.eql(['value1', 'value2']);
      });
      it('should parse a nested jsonpath', () => {
        const values = parseManifest(jsonManifest, 'json', '$.key2.key3[*]');
        expect(values).to.eql(['value3']);
      });
    });

    describe('yaml input', () => {
      it('should parse a jsonpath', () => {
        it('should parse a simple jsonpath', () => {
          const values = parseManifest(yamlManifest, 'yaml', '$.key1[*]');
          expect(values).to.eql(['value1', 'value2']);
        });
        it('should parse a nested jsonpath', () => {
          const values = parseManifest(yamlManifest, 'yaml', '$.key2.key3[*]');
          expect(values).to.eql(['value3']);
        });
      });
    });
  });

  describe('getFileList', async () => {
    it('should read from the explicit file list', async () => {
      const config = {
        generatedFiles: ['file1.txt', 'file2.txt'],
      };
      const list = await getFileList(
        config,
        new ProbotOctokit(),
        'owner',
        'repo'
      );
      expect(list).to.eql(['file1.txt', 'file2.txt']);
    });

    it('should combine multiple manifests', async () => {
      const config: Configuration = {
        externalManifests: [
          {
            type: 'json',
            file: 'manifest.json',
            jsonpath: '$.key1[*]',
          },
          {
            type: 'yaml',
            file: 'manifest.yaml',
            jsonpath: '$.key2.key3[*]',
          },
        ],
      };
      requests = requests
        .get('/repos/owner/repo/contents/manifest.json')
        .reply(200, {
          content: Buffer.from(jsonManifest, 'utf8').toString('base64'),
        })
        .get('/repos/owner/repo/contents/manifest.yaml')
        .reply(200, {
          content: Buffer.from(yamlManifest, 'utf8').toString('base64'),
        });
      const list = await getFileList(
        config,
        new ProbotOctokit(),
        'owner',
        'repo'
      );
      expect(list).to.eql(['value1', 'value2', 'value3']);
      requests.done();
    });

    it('should combine multiple manifests with explicit filelist', async () => {
      const config: Configuration = {
        generatedFiles: ['file1.txt'],
        externalManifests: [
          {
            type: 'json',
            file: 'manifest.json',
            jsonpath: '$.key1[*]',
          },
          {
            type: 'yaml',
            file: 'manifest.yaml',
            jsonpath: '$.key2.key3[*]',
          },
        ],
      };
      requests = requests
        .get('/repos/owner/repo/contents/manifest.json')
        .reply(200, {
          content: Buffer.from(jsonManifest, 'utf8').toString('base64'),
        })
        .get('/repos/owner/repo/contents/manifest.yaml')
        .reply(200, {
          content: Buffer.from(yamlManifest, 'utf8').toString('base64'),
        });
      const list = await getFileList(
        config,
        new ProbotOctokit(),
        'owner',
        'repo'
      );
      expect(list).to.eql(['file1.txt', 'value1', 'value2', 'value3']);
      requests.done();
    });

    it('should handle missing manifest files', async () => {
      const config: Configuration = {
        externalManifests: [
          {
            type: 'json',
            file: 'manifest.json',
            jsonpath: '$.key1[*]',
          },
        ],
      };
      requests = requests
        .get('/repos/owner/repo/contents/manifest.json')
        .reply(404, {
          content: Buffer.from(jsonManifest, 'utf8').toString('base64'),
        });
      const list = await getFileList(
        config,
        new ProbotOctokit(),
        'owner',
        'repo'
      );
      expect(list).to.eql([]);
      requests.done();
    });
  });

  describe('getPullRequestFiles', () => {
    it('should fetch the list from GitHub', async () => {
      requests = requests
        .get('/repos/owner/repo/pulls/1234/files')
        .reply(200, [
          {filename: 'file1.txt'},
          {filename: 'file2.txt'},
          {filename: 'file3.txt'},
        ]);

      const list = await getPullRequestFiles(
        new ProbotOctokit(),
        'owner',
        'repo',
        1234
      );
      expect(list).to.eql(['file1.txt', 'file2.txt', 'file3.txt']);
      requests.done();
    });
  });

  describe('buildCommentMessage', () => {
    it('should build a list of templates in the comment', () => {
      const templateList = new Set<string>();
      templateList.add('file1.txt');
      templateList.add('file2.txt');

      const body = buildCommentMessage(templateList);
      expect(body).to
        .equal(`*Warning*: This pull request is touching the following templated files:

* file1.txt
* file2.txt`);
    });
  });

  describe('handler', () => {
    let probot: Probot;

    beforeEach(() => {
      probot = createProbot({
        githubToken: 'abc123',
        Octokit: ProbotOctokit,
      });

      probot.load(handler);
    });

    describe('opened pull request', () => {
      const payload = JSON.parse(
        fs
          .readFileSync(
            resolve(fixturesPath, 'events', 'pull_request_opened.json')
          )
          .toString()
      );

      it('ignores repo without configuration', async () => {
        requests = requests
          .get(
            '/repos/testOwner/testRepo/contents/.github%2Fgenerated-files-bot.yml'
          )
          .reply(404)
          .get(
            '/repos/testOwner/.github/contents/.github%2Fgenerated-files-bot.yml'
          )
          .reply(404);
        await probot.receive({
          name: 'pull_request',
          payload: payload,
          id: 'abc123',
        });
        requests.done();
      });

      it('ignores pull request that does not touch templated files', async () => {
        const validConfig = fs.readFileSync(
          resolve(fixturesPath, 'config', 'valid-config.yml')
        );
        requests = requests
          .get(
            '/repos/testOwner/testRepo/contents/.github%2Fgenerated-files-bot.yml'
          )
          .reply(200, validConfig)
          .get('/repos/testOwner/testRepo/contents/manifest.json')
          .reply(200, {
            content: Buffer.from(jsonManifest, 'utf8').toString('base64'),
          })
          .get('/repos/testOwner/testRepo/contents/manifest.yaml')
          .reply(200, {
            content: Buffer.from(yamlManifest, 'utf8').toString('base64'),
          })
          .get('/repos/testOwner/testRepo/pulls/6/files')
          .reply(200, [{filename: 'file2.txt'}, {filename: 'file3.txt'}]);
        await probot.receive({
          name: 'pull_request',
          payload: payload,
          id: 'abc123',
        });
        requests.done();
      });

      it('comments on pull request that touches templated files', async () => {
        const validConfig = fs.readFileSync(
          resolve(fixturesPath, 'config', 'valid-config.yml')
        );
        requests = requests
          .get(
            '/repos/testOwner/testRepo/contents/.github%2Fgenerated-files-bot.yml'
          )
          .reply(200, validConfig)
          .get('/repos/testOwner/testRepo/contents/manifest.json')
          .reply(200, {
            content: Buffer.from(jsonManifest, 'utf8').toString('base64'),
          })
          .get('/repos/testOwner/testRepo/contents/manifest.yaml')
          .reply(200, {
            content: Buffer.from(yamlManifest, 'utf8').toString('base64'),
          })
          .get('/repos/testOwner/testRepo/pulls/6/files')
          .reply(200, [
            {filename: 'file1.txt'},
            {filename: 'file2.txt'},
            {filename: 'file3.txt'},
            {filename: 'value1'},
          ])
          .post('/repos/testOwner/testRepo/issues/6/comments', body => {
            snapshot(body);
            return true;
          })
          .reply(200);
        await probot.receive({
          name: 'pull_request',
          payload: payload,
          id: 'abc123',
        });
        requests.done();
      });

      it('ignores missing manifests', async () => {
        const validConfig = fs.readFileSync(
          resolve(fixturesPath, 'config', 'valid-config.yml')
        );
        requests = requests
          .get(
            '/repos/testOwner/testRepo/contents/.github%2Fgenerated-files-bot.yml'
          )
          .reply(200, validConfig)
          .get('/repos/testOwner/testRepo/contents/manifest.json')
          .reply(200, {
            content: Buffer.from(jsonManifest, 'utf8').toString('base64'),
          })
          .get('/repos/testOwner/testRepo/contents/manifest.yaml')
          .reply(404)
          .get('/repos/testOwner/testRepo/pulls/6/files')
          .reply(200, [
            {filename: 'file1.txt'},
            {filename: 'file2.txt'},
            {filename: 'file3.txt'},
            {filename: 'value1'},
          ]);
        await probot.receive({
          name: 'pull_request',
          payload: payload,
          id: 'abc123',
        });
        requests.done();
      });
    });
  });
});
