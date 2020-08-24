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
