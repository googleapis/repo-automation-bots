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

// eslint-disable-next-line node/no-extraneous-import
import AggregateError from 'aggregate-error';
import {GCFLogger} from './gcf-logger';

export const ERROR_REPORTING_TYPE_NAME =
  'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent';

/**
 * Log errors for Error Reporting. If the handled error is an
 * AggregateError, log each of its contained errors individually.
 * @param {GCFLogger} logger The logger to log to
 * @param {Error} e The error to log
 */
export function logErrors(
  logger: GCFLogger,
  e: Error,
  shouldReportErrors = true
) {
  // Add "@type" bindings so that Cloud Error Reporting will capture these logs.
  const bindings: Record<string, any> = logger.getBindings();
  if (shouldReportErrors && bindings['@type'] !== ERROR_REPORTING_TYPE_NAME) {
    logger = logger.child({
      '@type': ERROR_REPORTING_TYPE_NAME,
      ...bindings,
    });
  }
  if (e instanceof AggregateError) {
    for (const inner of e) {
      // AggregateError should not contain an AggregateError, but
      // we can run this recursively anyways.
      logErrors(logger, inner, shouldReportErrors);
    }
  } else {
    logger.error(e);
  }
}
