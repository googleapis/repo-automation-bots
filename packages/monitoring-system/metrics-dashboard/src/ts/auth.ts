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

/* eslint-disable node/no-unpublished-import */
import * as firebase from 'firebase';
import * as firebaseui from 'firebaseui';
import {AuthenticatedFirestore} from './firestore/firestore-client';

/** This is required to initialize the singleton app */
AuthenticatedFirestore.getClient();

// Initialize the FirebaseUI Widget using Firebase.
const ui = new firebaseui.auth.AuthUI(firebase.auth());

const uiConfig = {
  callbacks: {
    signInSuccessWithAuthResult: () => {
      return true;
    },
    uiShown: function () {
      document.getElementById('loader').style.display = 'none';
    },
  },
  signInFlow: 'popup',
  signInSuccessUrl: 'app.html',
  signInOptions: [firebase.auth.GoogleAuthProvider.PROVIDER_ID],
};

ui.start('#firebaseui-auth-container', uiConfig);
