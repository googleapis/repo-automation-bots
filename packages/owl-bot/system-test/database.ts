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

import {describe, it, before} from 'mocha';
import {Firestore} from '@google-cloud/firestore';
import {FirestoreConfigsStore, FirestoreCopyStateStore} from '../src/database';
import {Configs} from '../src/configs-store';
import {v4 as uuidv4} from 'uuid';
import * as assert from 'assert';

describe('database', () => {
  before(async function () {
    // When checks run on github, the call to db.collection().doc().get()
    // doesn't return an error; it never completes.  So, we need a timeout
    // to handle that case too.
    const timeOutPromise = new Promise((resolve, reject) => {
      setTimeout(() => reject('Timed out!'), 10000);
    });
    const db = new Firestore({preferRest: true});
    try {
      await Promise.race([
        timeOutPromise,
        db.collection('hello').doc('world').get(),
      ]);
    } catch (e) {
      // No connection to firestore.  Not possible to test.
      this.skip();
    }
  });

  it('stores and retrieves copy state', async () => {
    const db = new Firestore({preferRest: true});
    const store = new FirestoreCopyStateStore(db, 'test-' + uuidv4() + '-');
    const copyTag = uuidv4();
    const buildId = uuidv4();
    const repo = {
      owner: uuidv4(),
      repo: uuidv4(),
    };
    assert.ok(!(await store.findBuildForCopy(repo, copyTag)));
    await store.recordBuildForCopy(repo, copyTag, buildId);

    // Confirm we can find what we just recorded.
    assert.strictEqual(await store.findBuildForCopy(repo, copyTag), buildId);

    // Changing any one of the arguments should result in not found.
    assert.ok(!(await store.findBuildForCopy(repo, uuidv4())));
    assert.ok(
      !(await store.findBuildForCopy(
        {
          owner: repo.owner,
          repo: uuidv4(),
        },
        copyTag
      ))
    );
    assert.ok(
      !(await store.findBuildForCopy(
        {
          owner: uuidv4(),
          repo: repo.repo,
        },
        copyTag
      ))
    );
  });

  it('stores and retrieves configs', async () => {
    const db = new Firestore({preferRest: true});
    const store = new FirestoreConfigsStore(db, 'test-' + uuidv4() + '-');
    const repoA = 'googleapis/' + uuidv4();
    const repoB = 'googleapis/' + uuidv4();
    const dockerImageA = uuidv4();
    const dockerImageB = uuidv4();

    // Confirm that the new repo and dockerImage aren't stored yet.
    const noConfigs = await store.getConfigs(repoA);
    assert.strictEqual(noConfigs, undefined);
    const noRepos = await store.findReposWithPostProcessor(dockerImageA);
    assert.deepStrictEqual(noRepos, []);

    // Insert some configs.
    const configsA: Configs = {
      yamls: [
        {
          yaml: {
            docker: {
              image: dockerImageA,
            },
            'deep-copy-regex': [
              {
                source: '/alpha/.*',
                dest: '/beta',
              },
            ],
          },
          path: '/q/r/.OwlBot.yaml',
        },
        {
          yaml: {
            'deep-copy-regex': [
              {
                source: '/alpha/.*',
                dest: '/delta',
              },
            ],
          },
          path: '/s/t/.OwlBot.yaml',
        },
      ],
      lock: {
        docker: {
          image: dockerImageA,
          digest: '123',
        },
      },
      commitHash: 'abc',
      branchName: 'main',
      installationId: 42,
    };
    assert.ok(await store.storeConfigs(repoA, configsA, null));
    const configsB: Configs = {
      yamls: [
        {
          yaml: {
            'deep-copy-regex': [
              {
                source: '/gamma/.*',
                dest: '/omega',
              },
            ],
          },
          path: 'w/x/.OwlBot.yaml',
        },
      ],
      commitHash: 'def',
      branchName: 'master',
      installationId: 53,
    };
    assert.ok(await store.storeConfigs(repoB, configsB, null));
    try {
      // We should find the repo when we search for its docker image.
      let repos = await store.findReposWithPostProcessor(dockerImageA);
      assert.deepStrictEqual(repos, [[repoA, configsA]]);

      // And not find it if we search for a different docker image.
      repos = await store.findReposWithPostProcessor(dockerImageB);
      assert.deepStrictEqual(repos, []);

      // Confirm that storing with a mismatched hash doesn't store.
      assert.ok(!(await store.storeConfigs(repoA, configsA, 'xyz')));

      // Specify a new docker image and store again.
      configsA.yamls![0].yaml.docker!.image = dockerImageB;
      configsA.commitHash = 'def';
      assert.ok(await store.storeConfigs(repoA, configsA, 'abc'));

      // Make sure we find it now for dockerImageB.
      repos = await store.findReposWithPostProcessor(dockerImageB);
      assert.deepStrictEqual(repos, [[repoA, configsA]]);

      // And not find it if we search for a different docker image.
      repos = await store.findReposWithPostProcessor(dockerImageA);
      assert.deepStrictEqual(repos, []);

      // Test findReposAffectedByFileChanges().
      const reposAffected = await store.findReposAffectedByFileChanges([
        '/alpha/source.js',
      ]);
      assert.strictEqual(reposAffected.length, 1);
      const arepo = reposAffected[0];
      assert.deepStrictEqual(
        [arepo.repo.owner, arepo.repo.repo],
        repoA.split('/')
      );
      const yamlPaths = arepo.yamls.map(yaml => yaml.path);
      assert.deepStrictEqual(yamlPaths, [
        '/q/r/.OwlBot.yaml',
        '/s/t/.OwlBot.yaml',
      ]);
    } finally {
      await store.clearConfigs(repoA);
    }
  });

  it('stores and retrieves PRs for lock updates', async () => {
    const db = new Firestore({preferRest: true});
    const store = new FirestoreConfigsStore(db, 'test-');
    const repoA = 'googleapis/' + uuidv4();
    const dockerImageA = uuidv4();
    const configsA: Configs = {
      yamls: [
        {
          path: '.github/.OwlBot.yaml',
          yaml: {
            docker: {
              image: dockerImageA,
            },
            'deep-copy-regex': [
              {
                source: '/alpha',
                dest: '/beta',
              },
            ],
          },
        },
      ],
      lock: {
        docker: {
          image: dockerImageA,
          digest: '123',
        },
      },
      commitHash: 'abc',
      branchName: 'main',
      installationId: 42,
    };

    // Test pull requests.
    assert.strictEqual(
      await store.findBuildIdForUpdatingLock(repoA, configsA.lock!),
      undefined
    );

    // First one gets recorded.
    const BuildId = store.recordBuildIdForUpdatingLock(
      repoA,
      configsA.lock!,
      '10'
    );
    try {
      assert.strictEqual(await BuildId, '10');
      assert.strictEqual(
        await store.findBuildIdForUpdatingLock(repoA, configsA.lock!),
        '10'
      );

      // Second one does not.
      assert.strictEqual(
        await store.recordBuildIdForUpdatingLock(repoA, configsA.lock!, '11'),
        '10'
      );
    } finally {
      await store.clearBuildForUpdatingLock(repoA, configsA.lock!);
    }
  });
});
