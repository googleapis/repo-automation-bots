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

import admin from 'firebase-admin';
import {OwlBotLock, toFrontMatchRegExp} from './config-files';
import {AffectedRepo, Configs, ConfigsStore} from './configs-store';
import {CopyStateStore} from './copy-state-store';
import {githubRepoFromOwnerSlashName} from './github-repo';

export type Db = admin.firestore.Firestore;

/**
 * A google cloud build that updates ta repo.
 */
interface UpdateBuild {
  // The id provided build google cloud build.
  buildId: string;
  // Gets marked true after a cron job confirms the the google cloud build
  // job completed.
  buildCompletionObserved: boolean;
  // Set when completion observed.
  buildSucceeded?: boolean;
  // Maybe a link to a github issue or pull request.  Mainly for debugging
  // purposes.
  buildResult?: string;
}

interface PackedConfigs extends Configs {
  dockerImage?: string;
}

function packConfigs(configs: Configs): PackedConfigs {
  const packed: PackedConfigs = configs;
  for (const yaml of configs.yamls ?? []) {
    if (yaml.yaml.docker?.image) {
      packed.dockerImage = yaml.yaml.docker?.image;
    }
  }
  return packed;
}

function unpackConfigs(packed: PackedConfigs): Configs {
  return packed;
}

/**
 * When firebase sees a / in a doc id, it interprets it as a collection name.
 * So, we have to escape them.  Also escape +s because we use them for combining
 * strings into keys.  And use a format that can be decoded by decodeURIComponent().
 */
export function encodeId(s: string): string {
  return s.replace(/%/g, '%25').replace(/\//g, '%2F').replace(/\+/g, '%2B');
}

export function decodeId(s: string): string {
  return decodeURIComponent(s);
}

function makeUpdateLockKey(repo: string, lock: OwlBotLock): string {
  return [repo, lock.docker.image, lock.docker.digest].map(encodeId).join('+');
}

export class FirestoreConfigsStore implements ConfigsStore {
  private db: Db;
  readonly repoConfigs: string;
  readonly lockUpdateBuilds: string;

  /**
   * @param collectionsPrefix should only be overridden in tests.
   */
  constructor(db: Db, collectionsPrefix = 'owl-bot-') {
    this.db = db;
    this.repoConfigs = collectionsPrefix + 'repo-configs';
    this.lockUpdateBuilds = collectionsPrefix + 'lock-update-builds';
  }

  async getConfigs(repo: string): Promise<Configs | undefined> {
    const docRef = this.db.collection(this.repoConfigs).doc(encodeId(repo));
    const doc = await docRef.get();
    // Should we verify the data?
    return unpackConfigs(doc.data() as PackedConfigs);
  }

  async storeConfigs(
    repo: string,
    configs: Configs,
    replaceCommitHash: string | null
  ): Promise<boolean> {
    const docRef = this.db.collection(this.repoConfigs).doc(encodeId(repo));
    let updatedDoc = false;
    await this.db.runTransaction(async t => {
      const doc = await t.get(docRef);
      const prevConfigs = doc.data() as PackedConfigs | undefined;
      if (
        (prevConfigs && prevConfigs.commitHash === replaceCommitHash) ||
        (!prevConfigs && replaceCommitHash === null)
      ) {
        t.set(docRef, packConfigs(configs));
        updatedDoc = true;
      }
    });
    return updatedDoc;
  }

  async clearConfigs(repo: string): Promise<void> {
    const docRef = this.db.collection(this.repoConfigs).doc(encodeId(repo));
    await docRef.delete();
  }

  async findReposWithPostProcessor(
    dockerImageName: string
  ): Promise<[string, Configs][]> {
    const ref = this.db.collection(this.repoConfigs);
    const got = await ref.where('dockerImage', '==', dockerImageName).get();
    return got.docs.map(doc => [decodeId(doc.id), doc.data() as Configs]);
  }

  async findBuildIdForUpdatingLock(
    repo: string,
    lock: OwlBotLock
  ): Promise<string | undefined> {
    const docRef = this.db
      .collection(this.lockUpdateBuilds)
      .doc(makeUpdateLockKey(repo, lock));
    const got = await docRef.get();
    return got.exists ? (got.data() as UpdateBuild).buildId : undefined;
  }

  async recordBuildIdForUpdatingLock(
    repo: string,
    lock: OwlBotLock,
    buildId: string
  ): Promise<string> {
    const docRef = this.db
      .collection(this.lockUpdateBuilds)
      .doc(makeUpdateLockKey(repo, lock));
    const data: UpdateBuild = {buildId, buildCompletionObserved: false};
    await this.db.runTransaction(async t => {
      const got = await t.get(docRef);
      if (got.exists) {
        buildId = (got.data() as UpdateBuild).buildId;
      } else {
        t.set(docRef, data);
      }
    });
    return buildId;
  }

  async clearBuildForUpdatingLock(
    repo: string,
    lock: OwlBotLock
  ): Promise<void> {
    const docRef = this.db
      .collection(this.lockUpdateBuilds)
      .doc(makeUpdateLockKey(repo, lock));
    await docRef.delete();
  }

  async findReposAffectedByFileChanges(
    changedFilePaths: string[]
  ): Promise<AffectedRepo[]> {
    // This loop runs in time O(n*m), where
    // n = changedFilePaths.length
    // m = # .OwlBot.yaml files stored in config store.
    // It scans all the values in the collection.  There are many opportunities
    // to optimize if performance becomes a problem.
    const snapshot = await this.db.collection(this.repoConfigs).get();
    const result: AffectedRepo[] = [];
    let i = 0;
    snapshot.forEach(doc => {
      i++;
      const configs = doc.data() as Configs | undefined;
      for (const yaml of configs?.yamls ?? []) {
        match_loop: for (const copy of yaml.yaml['deep-copy-regex'] ?? []) {
          let regExp;
          try {
            regExp = toFrontMatchRegExp(copy.source);
          } catch (e) {
            console.error(
              `${doc.id} contains an invalid regular expression: ${copy.source}.\n${e}`
            );
            continue;
          }
          for (const path of changedFilePaths) {
            if (regExp.test(path)) {
              result.push({
                repo: githubRepoFromOwnerSlashName(decodeId(doc.id)),
                yamlPath: yaml.path,
              });
              break match_loop;
            }
          }
        }
      }
    });
    console.info(`walked ${i} configs`);
    return result;
  }
}

export class FirestoreCopyStateStore implements CopyStateStore {
  private db: Db;
  readonly copyBuilds: string;

  /**
   * @param collectionsPrefix should only be overridden in tests.
   */
  constructor(db: Db, collectionsPrefix = 'owl-bot-') {
    this.db = db;
    this.copyBuilds = collectionsPrefix + 'copy-builds';
  }

  async recordBuildForCopy(copyTag: string, buildId: string): Promise<void> {
    await this.db
      .collection(this.copyBuilds)
      .doc(encodeId(copyTag))
      .set({buildId});
  }

  async findBuildForCopy(copyTag: string): Promise<string | undefined> {
    return (
      await this.db.collection(this.copyBuilds).doc(encodeId(copyTag)).get()
    ).data()?.buildId;
  }
}
