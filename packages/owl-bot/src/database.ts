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
import {OwlBotLock} from './config-files';
import {Configs, ConfigsStore} from './configs-store';
import {IMinimatch, Minimatch} from 'minimatch';
import {CopyTasksStore} from './copy-tasks-store';

export type Db = admin.firestore.Firestore;
interface UpdatePr {
  pullRequestId: string;
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
  readonly lockUpdatePrs: string;
  readonly copyTasks: string;

  /**
   * @param collectionsPrefix should only be overridden in tests.
   */
  constructor(db: Db, collectionsPrefix = 'owl-bot-') {
    this.db = db;
    this.yamls = collectionsPrefix + 'yamls';
    this.lockUpdatePrs = collectionsPrefix + 'lock-update-prs';
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

  async findPullRequestForUpdatingLock(
    repo: string,
    lock: OwlBotLock
  ): Promise<string | undefined> {
    const docRef = this.db
      .collection(this.lockUpdatePrs)
      .doc(makeUpdateLockKey(repo, lock));
    const got = await docRef.get();
    return got.exists ? (got.data() as UpdatePr).pullRequestId : undefined;
  }

  async recordPullRequestForUpdatingLock(
    repo: string,
    lock: OwlBotLock,
    pullRequestId: string
  ): Promise<string> {
    const docRef = this.db
      .collection(this.lockUpdatePrs)
      .doc(makeUpdateLockKey(repo, lock));
    const data: UpdatePr = {pullRequestId: pullRequestId};
    await this.db.runTransaction(async t => {
      const got = await t.get(docRef);
      if (got.exists) {
        pullRequestId = (got.data() as UpdatePr).pullRequestId;
      } else {
        t.set(docRef, data);
      }
    });
    return pullRequestId;
  }

  async clearPullRequestForUpdatingLock(
    repo: string,
    lock: OwlBotLock
  ): Promise<void> {
    const docRef = this.db
      .collection(this.lockUpdatePrs)
      .doc(makeUpdateLockKey(repo, lock));
    await docRef.delete();
  }

  async findReposAffectedByFileChanges(
    changedFilePaths: string[]
  ): Promise<string[]> {
    // This loop runs in time O(n*m), where
    // n = changedFilePaths.length
    // m = # repos stored in config store.
    // It scans all the values in the collection.  There are many opportunities
    // to optimize if performance becomes a problem.
    const snapshot = await this.db.collection(this.yamls).get();
    const result: string[] = [];
    snapshot.forEach(doc => {
      const configs = doc.data() as Configs | undefined;
      match_loop: for (const copy of configs?.yaml?.['copy-dirs'] ?? []) {
        const mm = newMinimatchFromSource(copy.source);
        for (const path of changedFilePaths) {
          if (mm.match(path)) {
            result.push(decodeId(doc.id));
            break match_loop;
          }
        }
      }
    });
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

// Exported for testing purposes.
export function newMinimatchFromSource(pattern: string): IMinimatch {
  return new Minimatch(makePatternMatchAllSubdirs(pattern), {matchBase: true});
}

function makePatternMatchAllSubdirs(pattern: string): string {
  // Make sure pattern always ends with /**
  if (pattern.endsWith('/**')) {
    // Good, nothing to do.
  } else if (pattern.endsWith('/*')) {
    pattern += '*';
  } else if (pattern.endsWith('/')) {
    pattern += '**';
  } else {
    pattern += '/**';
  }
  return pattern;
}
