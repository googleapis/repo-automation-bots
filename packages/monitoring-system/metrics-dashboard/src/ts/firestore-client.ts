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

import * as firebase from 'firebase/app';
/** Required for Firestore capabilities */
import 'firebase/firestore';

/**
 * Type aliases for concise code
 */
export type Firestore = firebase.firestore.Firestore;

export class AuthenticatedFirestore {

    private static firestore: Firestore;

  /**
   * Initializes the static Firestore client if it
   * is not already initialized
   */
  public static getClient(): Firestore {
    if (!this.firestore) {
      firebase.initializeApp({
        apiKey: 'AIzaSyCNYD0Pp6wnT36GcdxWkRVE9RTWt_2XfsU',
        authDomain: 'repo-automation-bots-metrics.firebaseapp.com',
        databaseURL: 'https://repo-automation-bots-metrics.firebaseio.com', // TODO: load from JSON
        projectId: 'repo-automation-bots-metrics',
        storageBucket: 'repo-automation-bots-metrics.appspot.com',
        messagingSenderId: '888867974133',
        appId: '1:888867974133:web:bd9986937d533731ed0ebc',
      });
      this.firestore = firebase.firestore();
    }
    return this.firestore;
  }
}