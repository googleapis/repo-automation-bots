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
import {Firestore, WriteResult} from '@google-cloud/firestore';
import pino from 'pino';
import {getPrimaryKey, FirestoreRecord} from '../types/firestore-schema';
import {hasUndefinedValues} from '../types/type-check-util';
import {logger} from '../util/logger';

export interface ProcessorOptions {
  firestore?: Firestore;
  logger?: pino.Logger; // TODO: swap this for GCFLogger when GCFLogger is separated from gcf-utils
}

export abstract class DataProcessor {
  protected firestore: Firestore;
  protected logger: pino.Logger;

  constructor(options?: ProcessorOptions) {
    this.firestore = options?.firestore || new Firestore();
    this.logger = options?.logger || logger;
  }

  /**
   * Collect new data from data source, process it, and store it in the database
   * @throws if there is an error while processing data source
   */
  public abstract collectAndProcess(): Promise<void>;

  /**
   * Inserts the given document into the specified collection in Firestore, following these rules:
   * - if a document with the same key already exists, updates the fields with those in `doc`
   * - if no document with the same key exists, creates a new document with fields from `doc`
   * @param record the firestore record to update
   * @throws if doc is invalid or doesn't match given collection
   */
  protected async updateFirestore(
    record: FirestoreRecord
  ): Promise<WriteResult> {
    const {doc, collection} = record;

    if (hasUndefinedValues(doc)) {
      this.logger.error({
        message: 'Firestore doc cannot have undefined values',
        invalidDoc: doc,
        collection: collection.toString(),
      });
      return Promise.reject();
    }

    const docKey = getPrimaryKey(doc, collection);

    return this.firestore
      .collection(collection)
      .doc(docKey)
      .set(doc, {merge: true})
      .catch(error => {
        this.logger.error({
          message: `Failed to insert document into Firestore: ${error}`,
          document: doc,
          collection: collection,
        });
        throw error;
      });
  }
}
