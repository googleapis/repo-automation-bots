import FirebaseEmulator from '@firebase/testing';

const app = FirebaseEmulator.initializeTestApp({ projectId: 'repo-automation-bots' }).firestore();
app.collection('Bot').add({'hello': 'world'});
app.collection('Bot').get().then((snapshot) => {
    console.log(snapshot.docs[0].data());
})