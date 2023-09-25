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
