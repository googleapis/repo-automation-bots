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
//

import {
  Firestore,
  Settings,
  CollectionReference,
  DocumentData,
} from '@google-cloud/firestore';
import assert from 'assert';

/**
 * Key-value data in Firestore
 */
export interface FirestoreData {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

interface MockQuerySnapshot {
  docs: MockQueryDocumentSnapshot[];
}

interface MockQueryDocumentSnapshot {
  exists: boolean;
  data: () => FirestoreData;
}

export interface MockRecord {
  document: FirestoreData;
  collectionName: string;
}

/**
 * A class to mimic Firestore's NodeJS library
 * Note: not all behaviours are supported
 */
export class MockFirestore extends Firestore {
  mockData: FirestoreData;
  queryDelayMs = 50;
  collectionShouldThrow = false;
  setShouldThrow = false;

  /**
   * Create a mock client
   * @param mockData mock data returned by client
   * @param settings settings for the underlying Firestore client
   */
  constructor(mockData?: FirestoreData, settings?: Settings) {
    super(settings);
    this.mockData = mockData || {};
  }

  /**
   * Set the internal mock data to be returned by MockFirestore
   * @param mockData the mock data
   */
  setMockData(mockData: FirestoreData) {
    this.mockData = mockData;
  }

  /**
   * Adds the following record to the data
   * @param record record to add
   * @param collection collection in which to add record
   */
  addRecord(record: MockRecord) {
    let collection = this.mockData[record.collectionName];
    if (!collection) {
      throw new Error(
        `Collection ${record.collectionName} does not exist in MockFirestore`
      );
    }
    collection = {...collection, ...record.document};
  }

  /**
   * Asserts there exists a record in mock firestore
   * that has all the properties/values as the expected record.
   * The mock record will be allowed to have more properties
   * than the expected record.
   * @param expected expected record
   */
  assertRecord(expected: MockRecord) {
    const expectedDocumentKey = Object.keys(expected.document)[0];
    const collection = this.mockData[expected.collectionName];
    if (!collection) {
      throw new Error(
        `Collection ${expected.collectionName} does not exist in MockFirestore`
      );
    }
    const foundDocument = collection[expectedDocumentKey];
    if (!foundDocument) {
      throw new Error(
        `${expected.collectionName}/${expectedDocumentKey} not found in mock firestore`
      );
    }

    const expectedProps = expected.document[expectedDocumentKey] as FirestoreData;
    const foundProps = foundDocument as FirestoreData;
    for (const prop of Object.keys(expectedProps)) {
      if (expectedProps[prop]) {
        assert.equal(
          foundProps[prop],
          expectedProps[prop],
          `Expected mock execution record '${expectedDocumentKey}' ` +
            `to have property '${prop}' with value '${expectedProps[prop]}'. ` +
            `Mock execution record: ${JSON.stringify(foundDocument)}`
        );
      }
    }
  }

  /**
   * Set the artifical delay for returning query results.
   * Default delay is 50ms
   * @param ms the delay time in milliseconds.
   */
  setQueryDelay(ms: number) {
    this.queryDelayMs = ms;
  }

  /**
   * Throw an error when collections() is called
   */
  throwOnCollection() {
    this.collectionShouldThrow = true;
  }

  /**
   * Throw an error when set() is called
   */
  throwOnSet() {
    this.setShouldThrow = true;
  }

  /**
   * Return the specified collection from the mock data
   * @param collectionPath path to the collection
   */
  public collection(collectionPath: string): CollectionReference<DocumentData> {
    if (this.collectionShouldThrow) {
      throw new Error('Mock error');
    }

    const collection = {
      get: () => this.resolveAfterDelay(this.getQuerySnapshot(collectionPath)),
      doc: (docPath: string) => {
        return {
          set: (data: FirestoreData) => {
            if (this.setShouldThrow) {
              this.rejectAfterDelay(null);
            }
            const collection = this.getDocFromPath(
              this.mockData,
              collectionPath
            );
            collection[docPath] = data;
            return this.resolveAfterDelay(null);
          },
        };
      },
    };

    // recast as unknown to avoid mocking all internal objects
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (collection as unknown) as any;
  }

  private resolveAfterDelay(
    result: FirestoreData | null
  ): Promise<FirestoreData | null> {
    return new Promise(resolve => {
      setTimeout(() => resolve(result), this.queryDelayMs);
    });
  }

  private rejectAfterDelay(
    result: FirestoreData | null
  ): Promise<FirestoreData | null> {
    return new Promise(reject => {
      setTimeout(() => reject(result), this.queryDelayMs);
    });
  }

  private getDocFromPath(root: FirestoreData, path: string) {
    const parts = path.split('/');
    let doc = root;
    for (const key of parts) {
      doc = doc[key];
      if (!doc) {
        break;
      }
    }
    return doc;
  }

  private getQuerySnapshot(collectionPath: string): MockQuerySnapshot {
    const collection = this.getDocFromPath(this.mockData, collectionPath);
    return {docs: collection ? this.createQuerySnapshot(collection) : []};
  }

  private createQuerySnapshot(
    data: FirestoreData
  ): MockQueryDocumentSnapshot[] {
    const snapshot: MockQueryDocumentSnapshot[] = [];

    if (!data || Object.keys(data).length === 0) {
      return snapshot;
    }

    for (const key of Object.keys(data)) {
      snapshot.push({
        exists: true,
        data: () => {
          return data[key];
        },
      });
    }

    return snapshot;
  }
}
