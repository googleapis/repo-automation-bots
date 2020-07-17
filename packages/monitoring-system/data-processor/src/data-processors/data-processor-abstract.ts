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
import firebaseAdmin from 'firebase-admin';
type Firestore = firebaseAdmin.firestore.Firestore;

export abstract class DataProcessor {

  static firestore: Firestore;

  constructor() {
    if (!DataProcessor.firestore) {
      firebaseAdmin.initializeApp(); // may need to pass credentials here
      DataProcessor.firestore = firebaseAdmin.firestore();
    }
  }

  /**
   * Collect new data from data source, process it, and store it in the database
   * @throws if there is an error while processing data source
   */
  public abstract async collectAndProcess(): Promise<void>;
}
