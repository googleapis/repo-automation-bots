import firebaseAdmin from 'firebase-admin';
type Firestore = firebaseAdmin.firestore.Firestore;

export abstract class DataProcessor {
  firestore: Firestore;

  constructor() {
    firebaseAdmin.initializeApp(); // may need to pass credentials here
    this.firestore = firebaseAdmin.firestore();
  }

  /**
   * Collect new data from data source, process it, and store it in the database
   * @throws if there is an error while processing data source
   */
  public abstract async collectAndProcess(): Promise<void>;
}
