import {Subscription, SubscriptionOptions, PubSub} from '@google-cloud/pubsub';
import randomString from 'randomstring';

type MessageHandler = (...args: any[]) => void;

class MockMessage {
  public ackWasCalled = false;
  public nackWasCalled = false;
  public data: Buffer;
  public id: string;

  constructor(data: Buffer) {
    this.data = data;
    this.id = randomString.generate(10);
  }

  ack() {
    this.ackWasCalled = true;
  }

  nack() {
    this.nackWasCalled = true;
  }
}

export class MockSubscription extends Subscription {
  private messageHandler: MessageHandler;

  private sentMessages: {[id: string]: MockMessage} = {};

  constructor(pubsub: PubSub, name: string, options?: SubscriptionOptions) {
    super(pubsub, name, options);
    this.messageHandler = () => {
      console.log('No message handler set');
    };
  }

  /**
   * Returns the name of the mock subscription
   */
  public getSubscriptionName(): string {
    return this.name;
  }

  /**
   * Sets a listener for mock messages
   * @param event the event to listen for. Events other than 'message' are ignored.
   * @param listener the callback that will be given the message
   */
  public on(event: string | symbol, listener: MessageHandler): this {
    if (event === 'message') {
      this.messageHandler = listener;
    }
    return this;
  }

  /**
   * Send a mock message to all listeners
   * @param messageData data to be included in the message
   */
  public sendMockMessage(messageData: Buffer): string {
    const message = new MockMessage(messageData);
    this.messageHandler(message);
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
