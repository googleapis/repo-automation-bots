import {BotRequest} from '../bot-request';
import {GCFLogger} from '../logging/gcf-logger';

type BotEnvironment = 'functions' | 'run';
export interface BackgroundRequest {
  id: string;
  eventName: string;
  body: string;
  targetEnvironment: BotEnvironment;
  targetName: string;
  delayInSeconds?: number;
}

export interface TaskEnqueuer {
  enqueueTask(request: BackgroundRequest, logger: GCFLogger): Promise<void>;

  loadTask(request: BotRequest, logger: GCFLogger): Promise<BotRequest>;
}
