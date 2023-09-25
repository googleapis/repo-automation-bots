// Copyright 2023 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import AggregateError from 'aggregate-error';
// eslint-disable-next-line node/no-extraneous-import
import {RequestError} from '@octokit/request-error';
// eslint-disable-next-line node/no-extraneous-import
import {GraphqlResponseError} from '@octokit/graphql';

interface RateLimits {
  userId?: number;
  remaining?: number;
  reset?: number;
  limit?: number;
  resource?: string;
}
const RATE_LIMIT_MESSAGE = 'API rate limit exceeded';
const RATE_LIMIT_REGEX = new RegExp('API rate limit exceeded for user ID (d+)');
const SECONDARY_RATE_LIMIT_MESSAGE = 'exceeded a secondary rate limit';

export function* eachError(e: Error): Generator<Error, void, void> {
  if (e instanceof AggregateError) {
    for (const inner of e) {
      for (const nested of eachError(inner)) {
        yield nested;
      }
    }
  } else {
    yield e;
  }
}

export function parseRateLimitError(e: Error): RateLimits | undefined {
  if (e instanceof RequestError) {
    if (e.status !== 403) {
      return undefined;
    }

    if (
      !!e.message.match(RATE_LIMIT_MESSAGE) ||
      e.response?.headers['x-ratelimit-remaining'] === '0'
    ) {
      const messageMatch = e.message.match(RATE_LIMIT_REGEX);
      return {
        userId: messageMatch ? parseInt(messageMatch[1]) : undefined,
        remaining: parseInt(
          e.response?.headers['x-ratelimit-remaining'] || '0'
        ),
        reset: parseInt(e.response?.headers['x-ratelimit-reset'] || '0'),
        limit: parseInt(e.response?.headers['x-ratelimit-limit'] || '0'),
        resource:
          (e.response?.headers['x-ratelimit-resource'] as string) || undefined,
      };
    } else if (e.message.includes(SECONDARY_RATE_LIMIT_MESSAGE)) {
      // Secondary rate limit errors do not return remaining quotas
      return {
        resource: 'secondary',
      };
    }
  } else if (e instanceof GraphqlResponseError) {
    if (e.headers['x-ratelimit-remaining'] === '0') {
      return {
        remaining: parseInt(e.headers['x-ratelimit-remaining']),
        reset: parseInt(e.headers['x-ratelimit-reset'] || '0'),
        limit: parseInt(e.headers['x-ratelimit-limit'] || '0'),
        resource: (e.headers['x-ratelimit-resource'] as string) || undefined,
      };
    }
    return undefined;
  }

  // other non-RequestErrors are not considered rate limit errors
  return undefined;
}

interface ServiceUnavailableData {
  message: string;
  stack?: string;
}

export function parseServiceUnavailableError(
  e: Error
): ServiceUnavailableData | undefined {
  if (e instanceof ServiceUnavailable) {
    return {
      message: e.message,
      stack: e.originalError.stack,
    };
  }
  return undefined;
}

/**
 * Bot can throw this error to indicate it experienced some form of
 * resource limitation.  GCFBootstrapper will catch this and return
 * HTTP 503 to suggest Cloud Task adds backoff for the next attempt.
 */
export class ServiceUnavailable extends Error {
  readonly originalError: Error;
  constructor(message: string, err: Error) {
    super(message);
    this.originalError = err;
  }
}
