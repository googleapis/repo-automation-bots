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
import {Subscription, SubscriptionOptions, PubSub} from '@google-cloud/pubsub';
import randomString from 'randomstring';

/* eslint-disable @typescript-eslint/no-explicit-any */
type MessageHandler = (...args: any[]) => void;

class MockMessage {
  public data: Buffer;
  public id: string;
  public ackWasCalled = false;
  public nackWasCalled = false;
  private ackShouldThrow: boolean;

  constructor(data: Buffer, ackShouldThrow: boolean) {
    this.data = data;
    this.id = randomString.generate(10);
    this.ackShouldThrow = ackShouldThrow;
  }

  ack() {
    if (this.ackShouldThrow) {
      throw new Error('This is a mock error');
    }
    this.ackWasCalled = true;
  }

  nack() {
    this.nackWasCalled = true;
  }
}

export class MockSubscription extends Subscription {
  private messageHandler?: MessageHandler;
  private queuedMessages: MockMessage[] = [];
  private sentMessages: {[id: string]: MockMessage} = {};
  private onShouldThrow = false;
  private ackShouldThrow = false;

  constructor(pubsub: PubSub, name: string, options?: SubscriptionOptions) {
    super(pubsub, name, options);
  }

  /**
   * Returns the name of the mock subscription
   */
  public getSubscriptionName(): string {
    return this.name;
  }

  public throwErrorOnSetHandler() {
    this.onShouldThrow = true;
  }

  public throwErrorOnAck() {
    this.ackShouldThrow = true;
  }

  /**
   * Sets a listener for mock messages and calls it for any queued messages
   * @param event the event to listen for. Events other than 'message' are ignored.
   * @param listener the callback that will be given the message
   */
  public on(event: string | symbol, listener: MessageHandler): this {
    if (this.onShouldThrow) {
      throw new Error('This is a mock Error');
    }
    if (event === 'message') {
      this.messageHandler = listener;
      this.queuedMessages.forEach(msg => listener(msg));
      this.queuedMessages = [];
    }
    return this;
  }

  /**
   * Send a mock message to all listeners
   * @param messageData data to be included in the message
   */
  public sendMockMessage(messageData: Buffer): string {
    const message = new MockMessage(messageData, this.ackShouldThrow);
    if (!this.messageHandler) {
      this.queuedMessages.push(message);
    } else {
      this.messageHandler(message);
    }
    this.sentMessages[message.id] = message;
    return message.id;
  }

  /**
   * Check if ack() was called on the message with the given id
   * @param messageId message id of a delivered message
   */
  public wasAcked(messageId: string): boolean {
    const message = this.sentMessages[messageId];
    if (!message) {
      throw new Error(`Message with id ${messageId} was never sent`);
    }
    return message.ackWasCalled;
  }

  /**
   * Check if nack() was called on the message with the given id
   * @param messageId message id of a delivered message
   */
  public wasNacked(messageId: string): boolean {
    const message = this.sentMessages[messageId];
    if (!message) {
      throw new Error(`Message with id ${messageId} was never sent`);
    }
    return message.nackWasCalled;
  }

  /**
   * Check if neither ack() nor nack() was called on the message with the given id
   * @param messageId message id of a delivered message
   */
  public wasNotAckedOrNacked(messageId: string): boolean {
    const message = this.sentMessages[messageId];
    if (!message) {
      throw new Error(`Message with id ${messageId} was never sent`);
    }
    return !message.ackWasCalled && !message.nackWasCalled;
  }
}
