import { BotRequest } from "../bot-request";


type CronType = 'repository' | 'installation' | 'global';
export const DEFAULT_CRON_TYPE: CronType = 'repository';

export interface ScheduledRequest {
  repo?: string;
  installation: {
    id: number;
  };
  message?: {[key: string]: string};
  cron_type?: CronType;
  cron_org?: string;
  allowed_organizations?: string[];
}

export function parseScheduledRequest(botRequest: BotRequest): ScheduledRequest {
  let body = JSON.parse(botRequest.rawBody.toString('utf8')) as ScheduledRequest;
  // PubSub messages have their payload encoded in body.message.data
  // as a base64 blob.
  if (body.message && body.message.data) {
    body = JSON.parse(Buffer.from(body.message.data, 'base64').toString());
  }
  return body;
}