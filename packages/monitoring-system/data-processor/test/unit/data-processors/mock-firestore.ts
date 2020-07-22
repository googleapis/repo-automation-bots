// import {
//   Firestore,
//   DocumentReference,
//   DocumentData,
//   CollectionReference,
//   Query,
//   FirestoreDataConverter,
//   WriteResult,
//   SetOptions,
//   UpdateData,
//   Precondition,
//   FieldPath,
//   DocumentSnapshot,
//   Settings,
//   QuerySnapshot,
//   WhereFilterOp,
//   OrderByDirection,
// } from '@google-cloud/firestore';

// export class MockDocumentSnapshot<T = DocumentData> extends DocumentSnapshot<T> {
//   mockData: T;
//   constructor(mockData: T) {
//     super();
//     this.mockData = mockData;
//   }
//   data(): T {
//     return this.mockData;
//   }
// }

// export class MockQuerySnapshot<T = DocumentData> {
  
//     query: Query<T>;

//     docs: Array<QueryDocumentSnapshot<T>>;
//     size: number;
//     empty: boolean;
//     readTime: Timestamp;

//     constructor(docs: T) {
//       this.docs = docs;

//     }

//     docChanges(): DocumentChange[] {
//       throw new Error('Not Supported');
//     }
    
//     forEach(
//       callback: (result: QueryDocumentSnapshot<T>) => void,
//       thisArg?: any
//     ): void {
//       throw new Error('Not Supported');
//     }
    
//     isEqual(other: QuerySnapshot<T>): boolean {
//       throw new Error('Not Supported');
//     }
// }

// export class MockDocumentReference<T = DocumentData> {
//   readonly id: string = '';

//   firestore: Firestore;

//   parent: CollectionReference<T>;

//   path = '';

//   mockDocument: T;

//   constructor(firestore: Firestore, parent: CollectionReference<T>, data: T) {
//     this.firestore = firestore;
//     this.parent = parent;
//     this.mockDocument = data;
//   }

//   collection(collectionPath: string): CollectionReference<DocumentData> {
//     throw new Error('Not Supported');
//   }

//   listCollections(): Promise<Array<CollectionReference<DocumentData>>> {
//     throw new Error('Not Supported');
//   }

//   create(data: T): Promise<WriteResult> {
//     throw new Error('Not Supported');
//   }

//   set(data: Partial<T>, options?: SetOptions): Promise<WriteResult> {
//     throw new Error('Not Supported');
//   }

//   update(
//     dataOrField: UpdateData | string | FieldPath,
//     ...preconditionOrValues: Array<
//       unknown | string | FieldPath | Precondition
//     >
//   ): Promise<WriteResult> {
//     throw new Error('Not Supported');
//   }

//   delete(precondition?: Precondition): Promise<WriteResult> {
//     throw new Error('Not Supported');
//   }

//   get(): Promise<DocumentSnapshot<T>> {
//     return new Promise((resolve) => {
//       setTimeout(() => resolve(new MockDocumentSnapshot(this.mockDocument)), 100)
//     });
//   }

//   onSnapshot(
//     onNext: (snapshot: DocumentSnapshot<T>) => void,
//     onError?: (error: Error) => void
//   ): () => void {
//     throw new Error('Not Supported');
//   }

//   isEqual(other: DocumentReference<T>): boolean {
//     throw new Error('Not Supported');
//   }

//   withConverter<U>(converter: FirestoreDataConverter<U>): DocumentReference<U> {
//     throw new Error('Not Supported');
//   }
// }

// export class MockCollectionReference<T = DocumentData> {
//   mockCollection: any;
//   firestore: Firestore;
//   id = '';
//   parent: DocumentReference<DocumentData> | null = null;
//   path = '';

//   constructor(mockCollection: any, firestore: Firestore) {
//     this.mockCollection = mockCollection;
//     this.firestore = firestore;
//   }

//   where(
//     fieldPath: string | FieldPath,
//     opStr: WhereFilterOp,
//     value: any
//   ): Query<T>  {
//     throw new Error('Not Supported');
//   }

//   orderBy(
//     fieldPath: string | FieldPath,
//     directionStr?: OrderByDirection
//   ): Query<T>  {
//     throw new Error('Not Supported');
//   }

//   limit(limit: number): Query<T>  {
//     throw new Error('Not Supported');
//   }
  
//   limitToLast(limit: number): Query<T>  {
//     throw new Error('Not Supported');
//   }
  
//   offset(offset: number): Query<T>  {
//     throw new Error('Not Supported');
//   }
  
//   select(...field: (string | FieldPath)[]): Query<T>  {
//     throw new Error('Not Supported');
//   }
  
//   startAt(snapshot?: DocumentSnapshot<any>, ...fieldValues: any[]): Query<T>  {
//     throw new Error('Not Supported');
//   }
  
//   startAfter(snapshot?: DocumentSnapshot<any>, ...fieldValues: any[]): Query<T>  {
//     throw new Error('Not Supported');
//   }
  
//   endBefore(snapshot?: DocumentSnapshot<any>, ...fieldValues: any[]): Query<T>  {
//     throw new Error('Not Supported');
//   }

//   endAt(snapshot?: DocumentSnapshot<any>, ...fieldValues: any[]): Query<T> {
//     throw new Error('Not Supported');
//   }

//   get(): Promise<QuerySnapshot<T>> {
//     return new Promise((resolve) => {
//       setTimeout(() => resolve(), 100)
//     });
//   }

//   stream(): NodeJS.ReadableStream  {
//     throw new Error('Not Supported');
//   }
  
//   onSnapshot(
//     onNext: (snapshot: QuerySnapshot<T>) => void,
//     onError?: (error: Error) => void
//   ): () => void  {
//     throw new Error('Not Supported');
//   }

//   listDocuments(): Promise<Array<DocumentReference<T>>> {
//     throw new Error('Not Supported');
//   }

//   doc(documentPath?: string): DocumentReference<T> {
//     if (!documentPath) {
//       throw new Error('Not Supported');
//     }
//     const parts = documentPath.split('/');
//     if (parts.length !== 1) {
//       throw new Error('Not supported');
//     }
//     return new MockDocumentReference(
//       this.firestore,
//       this,
//       this.mockCollection[parts[0]]
//     );
//   }

//   add(data: T): Promise<DocumentReference<T>> {
//     throw new Error('Not Supported');
//   }

//   isEqual(other: CollectionReference<T>): boolean {
//     throw new Error('Not Supported');
//   }

//   withConverter<U>(
//     converter: FirestoreDataConverter<U>
//   ): CollectionReference<U> {
//     throw new Error('Not Supported');
//   }
// }

// export class MockFirestore extends Firestore {
//   mockData: any;

//   constructor(mockData: any, settings?: Settings) {
//     super(settings);
//     this.mockData = mockData;
//   }

//   public collection(
//     collectionPath: string
//   ): MockCollectionReference<DocumentData> {
//     const parts = collectionPath.split('/');
//     if (parts.length !== 1) {
//       throw new Error('Not supported');
//     }
//     return new MockCollectionReference(this.mockData[parts[0]], this);
//   }
// }
