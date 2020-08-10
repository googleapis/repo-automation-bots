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
import {
  getPrimaryKey,
  FirestoreCollection,
} from '../../src/firestore-schema';


describe('firestore-schema', () => {
  describe('getPrimaryKey', () => {
    it('returns the correct Bot document primary key', () => {
      const document = {bot_name: 'foo'};
      assert.equal(getPrimaryKey(document, FirestoreCollection.Bot), 'foo');
    });
    it('returns the correct Bot_Execution document primary key', () => {
      const document = {execution_id: 'foo_exec'};
      assert.equal(
        getPrimaryKey(document, FirestoreCollection.BotExecution),
        'foo_exec'
      );
    });
    it('returns the correct Task_Queue_Status document primary key', () => {
      const document = {queue_name: 'queue1', timestamp: 1234};
      assert.equal(
        getPrimaryKey(document, FirestoreCollection.TaskQueueStatus),
        'queue1_1234'
      );
    });
    it('returns the correct Error document primary key', () => {
      const document = {execution_id: 'foo_exec', timestamp: 1234};
      assert.equal(
        getPrimaryKey(document, FirestoreCollection.Error),
        'foo_exec_1234'
      );
    });
    it('returns the correct Trigger document primary key', () => {
      const document = {execution_id: 'foo_exec'};
      assert.equal(
        getPrimaryKey(document, FirestoreCollection.Trigger),
        'foo_exec'
      );
    });
    it('returns the correct Action document primary key', () => {
      const document = {
        execution_id: 'bar-id',
        action_type: 'foo',
        timestamp: 42,
      };
      assert.equal(
        getPrimaryKey(document, FirestoreCollection.Action),
        'bar-id_foo_42'
      );
    });
    it('returns the correct Action_Type document primary key', () => {
      const document = {name: 'bar'};
      assert.equal(
        getPrimaryKey(document, FirestoreCollection.ActionType),
        'bar'
      );
    });
    it('returns the correct GitHub_Event document primary key', () => {
      const document = {payload_hash: 'hash3456'};
      assert.equal(
        getPrimaryKey(document, FirestoreCollection.GitHubEvent),
        'hash3456'
      );
    });
    it('returns the correct GitHub_Repository document primary key', () => {
      const document = {repo_name: 'some-repo', owner_name: 'some-owner'};
      assert.equal(
        getPrimaryKey(document, FirestoreCollection.GitHubRepository),
        'some-repo_some-owner'
      );
    });
    it('returns the correct GitHub_Object document primary key', () => {
      const document = {
        object_type: 'baz-object',
        repository: 'some-repo',
        object_id: 3,
      };
      assert.equal(
        getPrimaryKey(document, FirestoreCollection.GitHubObject),
        'baz-object_some-repo_3'
      );
    });


    it('throws an error for mismatched document and collection', () => {
      const document = {payload_hash: 'hash3456'}; // GitHub Event doc
      try {
        getPrimaryKey(document, FirestoreCollection.Error);
        assert.fail('Expected error to be thrown');
      } catch (error) {
        assert(error);
      }
    });
    it('throws an error for unrecognized collection', () => {
      const document = {action_type: 'foo', timestamp: 42}; // missing execution_id
      try {
        getPrimaryKey(document, FirestoreCollection.Action);
        assert.fail('Expected error to be thrown');
      } catch (error) {
        assert(error);
      }
    });
    it('throws an error if document is missing key properties', () => {
      const document = {bot_name: 'bot1'};
      try {
        getPrimaryKey(document, 'UnknownCollection' as FirestoreCollection);
        assert.fail('Expected error to be thrown');
      } catch (error) {
        assert(error);
      }
    });
  });
});