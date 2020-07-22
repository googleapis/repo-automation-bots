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
import {describe, it} from 'mocha';
import assert from 'assert';
import {CloudTasksProcessor} from '../../../src/data-processors/cloud-tasks-data-processor';
import { CloudTasksClient, protos } from '@google-cloud/tasks';
import sinon from 'sinon';
import { Firestore, CollectionReference, Query } from '@google-cloud/firestore';

class dummyTask implements protos.google.cloud.tasks.v2.ITask {}

const MockTaskQueueData: {[parent: string]: [dummyTask, null, null]} = {
  "projectFoo/locationBar/queue1": [[new dummyTask(), new dummyTask(), new dummyTask()], null, null]
}

const MockFirestoreData: {[key: string]: any} = {
  Bot: {
    "ID1": {
      bot_name: "bot_a"
    }
  }
}

function getCollectionAsQuerySnapshot(collectionPath: string) {
  const parts = collectionPath.split("/");
  let rootDoc = MockFirestoreData;
  for (const key of parts) {
    rootDoc = rootDoc[key]
    if (!rootDoc) {
      throw Error("invalid path");
    }
  }
  return createQuerySnapshot(rootDoc);
}

function createQuerySnapshot(data: any): { docs: any[], data: () => any } | any {
  if (!data || typeof data !== "object") {
    return data;
  }

  return { 
    data: () => {return data},
    docs: Object.values(data).map(val => {return createQuerySnapshot(val)})
  }
}

describe('Cloud Tasks Data Processor', () => {
  describe('getBotNames()', () => {
    it('gets the bot names', () => {
      const mockFirestore = new Firestore();
      sinon.stub(mockFirestore, 'collection').callsFake((collectionPath) => {
        return ({
          get: sinon.stub().returns(new Promise(resolve => resolve(getCollectionAsQuerySnapshot(collectionPath)))),
        } as unknown) as any;
      })
      return new CloudTasksProcessor(mockFirestore)['getBotNames']().then(names => console.log(names));
    })
  });
  describe('getTaskQueueStatus()', () => {
    it('gets task queue status from Cloud Task', () => {
      const mockTasksClient = new CloudTasksClient();
      sinon.stub(mockTasksClient, 'queuePath').callsFake((project, location, queue) => {
        return `${project}/${location}/${queue}`;
      })
      sinon.stub(mockTasksClient, 'listTasks').callsFake((request, options) => {
        const result = request?.parent ? MockTaskQueueData[request.parent] : [];
        return new Promise(resolve => resolve(result));
      })
      return new CloudTasksProcessor(undefined, mockTasksClient)['getTaskQueueStatus']("projectFoo", "locationBar", ["queue1"]).then( status => console.log(status))
    });
  });
  describe('storeTaskQueueStatus()', () => {
    it('stores task queue status', () => {});
  });
});
