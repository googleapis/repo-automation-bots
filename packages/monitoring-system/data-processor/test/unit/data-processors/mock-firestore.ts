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

interface mockQuerySnapshot {
  docs: mockQueryDocumentSnapshot[];
}

interface mockQueryDocumentSnapshot {
  exists: boolean;
  data: () => {[key: string]: any};
}

/**
 * A class to mimic Firestore's NodeJS library
 */
export class MockFirestore extends Firestore {
  mockData: {[key: string]: any};
  queryDelayMs: number = 50;
  collectionShouldThrow: boolean = false;
  setShouldThrow: boolean = false;

  constructor(mockData?: {[key: string]: any}, settings?: Settings) {
    super(settings);
    this.mockData = mockData || {};
  }

  /**
   * Set the internal mock data to be returned by MockFirestore
   * @param mockData the mock data
   */
  setMockData(mockData: {[key: string]: any}) {
    this.mockData = mockData;
  }

  /**
   * Set the artifical delay for returning query results.
   * Default delay is 50ms
   * @param ms the delay time in milliseconds.
   */
  setQueryDelay(ms: number) {
    this.queryDelayMs = ms;
  }

  throwOnCollection() {
    this.collectionShouldThrow = true;
  }

  throwOnSet() {
    this.setShouldThrow = true;
  }

  public collection(collectionPath: string): CollectionReference<DocumentData> {
    
    if (this.collectionShouldThrow) {
      throw new Error('Mock error');
    }

    const collection = {
      get: () => this.resolveAfterDelay(this.getQuerySnapshot(collectionPath)),
      doc: (docPath: string) => {
        return {
          set: (data: {[key: string]: any}) => {
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
    return (collection as unknown) as any;
  }

  private resolveAfterDelay(result: any): Promise<any> {
    return new Promise(resolve => {
      setTimeout(() => resolve(result), this.queryDelayMs);
    });
  }

  private rejectAfterDelay(result: any): Promise<any> {
    return new Promise(reject => {
      setTimeout(() => reject(result), this.queryDelayMs);
    });
  }

  private getDocFromPath(root: {[key: string]: any}, path: string) {
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

  private getQuerySnapshot(collectionPath: string): mockQuerySnapshot {
    const collection = this.getDocFromPath(this.mockData, collectionPath);
    return {docs: collection ? this.createQuerySnapshot(collection) : []};
  }

  private createQuerySnapshot(data: any): mockQueryDocumentSnapshot[] {
    const snapshot: mockQueryDocumentSnapshot[] = [];

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
