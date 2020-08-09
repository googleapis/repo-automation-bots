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
import { FirestoreDocument, getPrimaryKey, FirestoreCollection as FSCollection } from '../types/firestore-schema';
import { hasUndefinedValues } from '../types/type-check-util';

export interface ProcessorOptions {
  firestore?: Firestore;
  logger?: pino.Logger; // TODO: would like to use GCFLogger here but would have to import all of gcf-utils which causes issues with promise-events
}

export abstract class DataProcessor {
  protected firestore: Firestore;
  protected logger: pino.Logger;

  constructor(options?: ProcessorOptions) {
    this.firestore = options?.firestore || new Firestore();
    this.logger = options?.logger || this.initLogger();
  }

  /**
   * Collect new data from data source, process it, and store it in the database
   * @throws if there is an error while processing data source
   */
  public abstract async collectAndProcess(): Promise<void>;

  private initLogger(): pino.Logger {
    const DEFAULT_LOG_LEVEL = 'trace';
    const defaultOptions: pino.LoggerOptions = {
      base: null,
      messageKey: 'message',
      timestamp: false,
      level: DEFAULT_LOG_LEVEL,
    };

    const dest = pino.destination({sync: true});
    return pino(defaultOptions, dest);
  }

  /**
   * Inserts the given document into the specified collection in Firestore, following these rules:
   * - if a document with the same key already exists, updates the fields with those in `doc`
   * - if no document with the same key exists, creates a new document with fields from `doc`
   * @param doc Firestore document to insert. Cannot contain undefined values.
   * @param collection collection in which document belongs
   * @param docKey (optional) the primary key for the given document
   * @throws if doc is invalid or doesn't match given collection
   */
  protected async updateFirestore(
    doc: FirestoreDocument,
    collection: FSCollection
  ): Promise<WriteResult> {

    if (hasUndefinedValues(doc)) {
      this.logger.error({
        message: "Firestore doc cannot have undefined values",
        invalidDoc: doc,
        collection: collection.toString()
      })
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
