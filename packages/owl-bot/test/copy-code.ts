// Copyright 2021 Google LLC
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
import * as assert from 'assert';
import {copyDirs} from '../src/copy-code';
import path from 'path';
import * as fs from 'fs';
import tmp from 'tmp';
import {OwlBotYaml} from '../src/config-files';
import {collectDirTree, makeDirTree} from './dir-tree';

describe('copyDirs', () => {
  /**
   * Creates a sample source tree.
   */
  function makeSourceTree(rootDir: string): string {
    makeDirTree(rootDir, [
      'source',
      'source/a',
      'source/b',
      'source/a/x',
      'source/b/y',
      'source/b/z',
      'source/q.txt:q',
      'source/a/r.txt:r',
      'source/b/y/s.txt:s',
    ]);
    return path.join(rootDir, 'source');
  }

  function makeSourceAndDestDirs(): [string, string] {
    const tempo = tmp.dirSync();
    const sourceDir = makeSourceTree(tempo.name);
    const destDir = path.join(tempo.name, 'dest');
    return [sourceDir, destDir];
  }

  it('copies subdirectory', () => {
    const [sourceDir, destDir] = makeSourceAndDestDirs();
    const yaml: OwlBotYaml = {
      'deep-copy-regex': [
        {
          source: '/b/(y)',
          dest: '/src/$1',
          'rm-dest': '',
        },
      ],
    };
    copyDirs(sourceDir, destDir, yaml);
    assert.deepStrictEqual(collectDirTree(destDir), [
      'src',
      'src/y',
      'src/y/s.txt:s',
    ]);
  });

  it('copies rootdirectory', () => {
    const [sourceDir, destDir] = makeSourceAndDestDirs();
    const yaml: OwlBotYaml = {
      'deep-copy-regex': [
        {
          source: '/a',
          dest: '/m/n',
          'rm-dest': '',
        },
      ],
    };
    copyDirs(sourceDir, destDir, yaml);
    assert.deepStrictEqual(collectDirTree(destDir), [
      'm',
      'm/n',
      'm/n/r.txt:r',
      'm/n/x',
    ]);
  });

  it('works for real java tree', () => {
    const tempDir = tmp.dirSync().name;
    const sourceDir = path.join(tempDir, 'googleapis');
    // prepare the source
    const sourcePath = path.join(
      sourceDir,
      'google/cloud/asset/v1p1beta1/google-cloud-asset-v1p1beta1-java/grpc-google-cloud-asset-v1p1beta1-java/src/main/java/com/google/cloud/asset/v1p1beta1/AssetServiceGrpc.java'
    );
    fs.mkdirSync(path.dirname(sourcePath), {recursive: true});
    fs.writeFileSync(sourcePath, 'from java import *;');

    // prepare the dest.
    const destDir = path.join(tempDir, 'java-asset');
    const files = [
      'README.md:I should be preserved.',
      'grpc-google-cloud-asset-v1p1beta1/src/main/delete-me.txt:I should be deleted.',
    ];
    for (const file of files) {
      const [relPath, content] = file.split(':');
      const fullPath = path.join(destDir, relPath);
      fs.mkdirSync(path.dirname(fullPath), {recursive: true});
      fs.writeFileSync(fullPath, content);
    }
    const yaml: OwlBotYaml = {
      'deep-copy-regex': [
        {
          source:
            '/google/cloud/asset/.*/.*-java/(grpc-google-cloud-asset-.*)-java',
          dest: '/$1',
          'rm-dest': '/grpc-google-cloud-asset-.*',
        },
      ],
    };

    // CopyDirs and confirm.
    copyDirs(sourceDir, destDir, yaml);
    assert.deepStrictEqual(collectDirTree(destDir), [
      'README.md:I should be preserved.',
      'grpc-google-cloud-asset-v1p1beta1',
      'grpc-google-cloud-asset-v1p1beta1/src',
      'grpc-google-cloud-asset-v1p1beta1/src/main',
      'grpc-google-cloud-asset-v1p1beta1/src/main/java',
      'grpc-google-cloud-asset-v1p1beta1/src/main/java/com',
      'grpc-google-cloud-asset-v1p1beta1/src/main/java/com/google',
      'grpc-google-cloud-asset-v1p1beta1/src/main/java/com/google/cloud',
      'grpc-google-cloud-asset-v1p1beta1/src/main/java/com/google/cloud/asset',
      'grpc-google-cloud-asset-v1p1beta1/src/main/java/com/google/cloud/asset/v1p1beta1',
      'grpc-google-cloud-asset-v1p1beta1/src/main/java/com/google/cloud/asset/v1p1beta1/AssetServiceGrpc.java:from java import *;',
    ]);
  });
});
