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
import {describe, it, beforeEach} from 'mocha';
import {MockSubscription} from './mocks/mock-pubsub-subscription';
import {PubSub} from '@google-cloud/pubsub';

describe('Cloud Logs Processor', () => {
  describe('collectAndProcess()', () => {
    describe('correctly formed execution start and execution end logs', () => {
      describe('when no execution record exists', () => {
        it('creates a new execution record and stores execution start logs', () => {
          const pubsub = new PubSub();
          const mocksubscription = new MockSubscription(pubsub, 'mock-sub');
          mocksubscription.on('message', message => console.log(message.data.toString()));
          mocksubscription.sendMockMessage(Buffer.from('hello world', 'utf-8'));
        });

        it('creates a new execution record and stores execution end logs');
      });

      describe('when an execution record already exists', () => {
        it('identifies existing record and stores execution start logs');

        it('identifies existing record and stores execution end logs');
      });
    });

    describe('correctly formed trigger information logs', () => {
      describe('when no execution record exists', () => {
        it(
          'creates a new execution record and stores trigger information logs'
        );
      });

      describe('when an execution record already exists', () => {
        it('identifies existing record and stores trigger information logs');
      });
    });

    describe('correctly formed GitHub action logs', () => {
      describe('when no execution record exists', () => {
        it('creates a new execution record and stores GitHub action logs');
      });

      describe('when an execution record already exists', () => {
        it('identifies existing record and stores GitHub action logs');
      });
    });

    describe('correctly formed error logs', () => {
      describe('when no execution record exists', () => {
        it('creates a new execution record and stores error logs');
      });

      describe('when an execution record already exists', () => {
        it('identifies existing record and stores error logs');
      });
    });

    describe('unidentifiable or malformed logs', () => {
      it('logs error for malformed execution start logs');

      it('logs error for malformed execution end logs');

      it('logs error for malformed trigger information logs');

      it('logs error for malformed GitHub action logs');

      it(
        'processes other correctly formed logs when one of the logs in PubSub message is malformed'
      );

      it('ignores log statements with an unidentified format');
    });

    describe('PubSub interaction', () => {
      it('correctly pulls new messages from PubSub');

      it('acknowledges PubSub messages if they are processed correctly');

      it(
        'does not acknowledge PubSub messages if there is an error in processing'
      );

      it('throws an error when cannot pull messages from PubSub');

      it('throws an error when cannot acknowledge a processed PubSub message');
    });
  });
});
