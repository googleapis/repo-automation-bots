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
import {Configs, ConfigsStore} from './configs-store';
import {CopyTasksStore} from './copy-tasks-store';
import {GithubRepo, githubRepoFromOwnerSlashName} from './github-repo';

export type Db = admin.firestore.Firestore;

/**
 * A google cloud build that updates ta repo.
 */
interface UpdateBuild {
  buildId: string;
}

interface CopyTask {
  pubsubMessageId: string;
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

function makeUpdateFilesKey(
  repo: string,
  googleapisGenCommitHash: string
): string {
  return [repo, googleapisGenCommitHash].map(encodeId).join('+');
}

export class FirestoreConfigsStore implements ConfigsStore, CopyTasksStore {
  private db: Db;
  readonly yamls: string;
  readonly lockUpdateBuilds: string;
  readonly copyTasks: string;

  /**
   * @param collectionsPrefix should only be overridden in tests.
   */
  constructor(db: Db, collectionsPrefix = 'owl-bot-') {
    this.db = db;
    this.yamls = collectionsPrefix + 'yamls';
    this.lockUpdateBuilds = collectionsPrefix + 'lock-update-builds';
    this.copyTasks = collectionsPrefix + 'copy-tasks';
  }

  async getConfigs(repo: string): Promise<Configs | undefined> {
    const docRef = this.db.collection(this.yamls).doc(encodeId(repo));
    const doc = await docRef.get();
    // Should we verify the data?
    return doc.data() as Configs;
  }

  async storeConfigs(
    repo: string,
    configs: Configs,
    replaceCommitHash: string | null
  ): Promise<boolean> {
    const docRef = this.db.collection(this.yamls).doc(encodeId(repo));
    let updatedDoc = false;
    await this.db.runTransaction(async t => {
      const doc = await t.get(docRef);
      const prevConfigs = doc.data() as Configs | undefined;
      if (
        (prevConfigs && prevConfigs.commitHash === replaceCommitHash) ||
        (!prevConfigs && replaceCommitHash === null)
      ) {
        t.set(docRef, configs);
        updatedDoc = true;
      }
    });
    return updatedDoc;
  }

  async clearConfigs(repo: string): Promise<void> {
    const docRef = this.db.collection(this.yamls).doc(encodeId(repo));
    await docRef.delete();
  }

  async findReposWithPostProcessor(
    dockerImageName: string
  ): Promise<[string, Configs][]> {
    const ref = this.db.collection(this.yamls);
    const got = await ref
      .where('yaml.docker.image', '==', dockerImageName)
      .get();
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
    const data: UpdateBuild = {buildId};
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
  ): Promise<GithubRepo[]> {
    // This loop runs in time O(n*m), where
    // n = changedFilePaths.length
    // m = # repos stored in config store.
    // It scans all the values in the collection.  There are many opportunities
    // to optimize if performance becomes a problem.
    const snapshot = await this.db.collection(this.yamls).get();
    const result: GithubRepo[] = [];
    let i = 0;
    snapshot.forEach(doc => {
      i++;
      const configs = doc.data() as Configs | undefined;
      match_loop: for (const copy of configs?.yaml?.['deep-copy-regex'] ?? []) {
        const regExp = toFrontMatchRegExp(copy.source);
        for (const path of changedFilePaths) {
          if (regExp.test(path)) {
            result.push(githubRepoFromOwnerSlashName(decodeId(doc.id)));
            break match_loop;
          }
        }
      }
    });
    console.info(`walked ${i} configs`);
    return result;
  }

  async findPubsubMessageIdForCopyTask(
    repo: string,
    googleapisGenCommitHash: string
  ): Promise<string | undefined> {
    const docRef = this.db
      .collection(this.copyTasks)
      .doc(makeUpdateFilesKey(repo, googleapisGenCommitHash));
    const got = await docRef.get();
    return got.exists ? (got.data() as CopyTask).pubsubMessageId : undefined;
  }

  async recordPubsubMessageIdForCopyTask(
    repo: string,
    googleapisGenCommitHash: string,
    pubsubMessageId: string
  ): Promise<string> {
    const docRef = this.db
      .collection(this.copyTasks)
      .doc(makeUpdateFilesKey(repo, googleapisGenCommitHash));
    const data: CopyTask = {pubsubMessageId};
    await this.db.runTransaction(async t => {
      const got = await t.get(docRef);
      if (got.exists) {
        pubsubMessageId = (got.data() as CopyTask).pubsubMessageId;
      } else {
        t.set(docRef, data);
      }
    });
    return pubsubMessageId;
  }

  async filterMissingCopyTasks(
    repos: string[],
    googleapisGenCommitHash: string
  ): Promise<string[]> {
    const snapshot = this.db.collection(this.copyTasks);
    const result: string[] = [];
    for (const repo of repos) {
      const docId = makeUpdateFilesKey(repo, googleapisGenCommitHash);
      const got = await snapshot.doc(docId).get();
      if (!got.exists) {
        result.push(repo);
      }
    }
    return result;
  }

  async clearPubsubMessageIdForCopyTask(
    repo: string,
    googleapisGenCommitHash: string
  ): Promise<void> {
    const docRef = this.db
      .collection(this.copyTasks)
      .doc(makeUpdateFilesKey(repo, googleapisGenCommitHash));
    await docRef.delete();
  }
}
