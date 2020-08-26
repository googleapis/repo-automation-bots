# gcf-utils

> Helper module to make [Probot](https://github.com/probot/probot) applications easier and more secure to run in Google Cloud Functions

## Usage

### GCFBootstrapper

TODO:(orthros)

### GCFLogger

`GCFLogger` is a standardized logger for Google Cloud Functions. It has in-built support for:

* [Cloud Logging Severity Levels](https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#logseverity)
* [Cloud Logging Special Fields](https://cloud.google.com/run/docs/logging#special-fields)
* Both [string logging](#log-a-string-statement) and [JSON structured Logging](#log-a-structured-json)
* [Synchronous flush](#synchronously-flush-logs)
* [Logging Custom Metrics](#manually-log-metrics)

`gcf-util` exports a configured instance of `GCFLogger` for bots to use. This instance will be synchronously flushed after the Bot's app function has completed, so you **do not need to flush this in your Bot's code**.

#### Import this in your bot

```typescript
import {logger} from 'gcf-utils';
```

#### Log a string statement

```typescript

logger.info('An info message');  // will show up as INFO log in Cloud Logging
logger.debug('A debug message');  // will show up as DEBUG log in Cloud Logging
logger.error('An error message');  // will show up as ERROR log in Cloud Logging
```
#### Log a structured JSON

```typescript
logger.debug({ 'debug-property': 'value' });
```

This means you don't have to stringify errors anymore:

```typescript
try {
    methodThatThrows()
} catch (errorThrown) {      // errorThrown = { name: 'HTTP Error', code: 404 }
    logger.error({
        message: `methodThatThrows threw an error`
        error: errorThrown
    })
}
```
Cloud Logging output for the lines above:

```javascript
{
    ... other log properties
    jsonPayload: {
        message: `methodThatThrows threw an error`
        error: {
            name: 'HTTP Error',
            code: 404
        }
    }
    ... other log properties
}
```

#### Synchronously Flush Logs

> :warning: If you are importing `logger` from `gcf-utils` as shown above, you **do not need to call the synchronous flush method**. `gcf-utils` automatically handles this once the Bot's application function completes

> :warning: `GCFLogger.flush()` only works for `SonicBoom` destinations, which is the default destination for this logger

To synchronously flush logs:

```typescript
import {logger} from 'gcf-utils';

logger.flush()
```

#### Automatically Logged Metrics

`gcf-utils` logs some metrics automatically with the help of `GCFLogger`. This is completely transparent to the Bot and requires no action from the Bot developer.

> :warning: If your Bot is not automatically logging the information above, please ensure that you are using gcf-utils 5.5.1 or above and you have `logging: true` in the `WrapperOptions` passed to `GCFBootstrapper.gcf()`

##### Execution Trigger Information

`gcf-utils` automatically logs information related to the trigger that initiated the Bot's execution. The following properties are logged:

| Property                 | Value Type | Value                                                  | Notes                                                       |
|--------------------------|------------|--------------------------------------------------------|-------------------------------------------------------------|
| message                  | string     | A descriptive message about the trigger                |                                                             |
| trigger                  | object     | Object containing trigger information                  |                                                             |
| ____trigger_type         | string     | Trigger source (eg. Github Webhook, Cloud Scheduler)   |                                                             |
| ____trigger_sender       | string     | GitHub username of user that triggered the webhook     | Only for GitHub WebHook triggers                            |
| ____github_delivery_guid | string     | GUID of the GitHub WebHook                             | Only for GitHub WebHook triggers and subsequent Cloud Tasks |
| ____payload_hash         | string     | An MD5 hash of the GitHub Event Payload                | Only for GitHub WebHook triggers                            |
| ____trigger_source_repo  | object     | Object containing GitHub source repository information | Only for GitHub WebHook triggers                            |
| ________owner            | string     | Username of the repository owner                       | Only for GitHub WebHook triggers                            |
| ________owner_type       | string     | The type of owner (eg. 'User' or 'Organization')       | Only for GitHub WebHook triggers                            |
| ________repo_name        | string     | The name of the GitHub repository                      | Only for GitHub WebHook triggers                            |
| ________url              | string     | URL to the GitHub repository (may be private)          | Only for GitHub WebHook triggers                            |

##### GitHub Action Information

`gcf-utils` automatically logs information related to any actions taken by a Bot on GitHub. 

> Note: only calls to GitHub that make a change to any GitHub objects are logged. Calls to GitHub that simply retrieve information are **not logged**. For example, if a Bot retrieves a list of issues from a repository and then adds a label to some issues, only the 'add label' actions will be logged, not the retrieving of the issues.

The following properties are logged:

| Property               | Value Type | Value                                                     | Notes                                                   |
|------------------------|------------|-----------------------------------------------------------|---------------------------------------------------------|
| action                 | object     | Object containing action information                      |                                                         |
| ____type               | string     | The type of action (eg. ISSUE_ADD_LABEL)                  |                                                         |
| ____value              | string     | The value associated with the action. (eg. name of label) | If action has no associated value, then value is 'NONE' |
| ____destination_object | object     | The GitHub object that received the action                | Only for actions that have an associated object         |
| ________object_type    | string     | The type of object (eg. PULL_REQUEST)                     | Only for actions that have an associated object         |
| ________object_id      | number     | The GitHub ID corresponding to the object                 | Only for actions that have an associated object         |
| ____destination_repo   | object     | The GitHub repository that received the action            |                                                         |
| ________repo_name      | string     | The name of the GitHub repository                         |                                                         |
| ________owner          | string     | The username of the GitHub repository owner               |                                                         |

#### Manually Log Metrics

`GCFLogger` also allows for custom logs-based metrics in addition to the metrics logged above. 

> Note: To have your Bot's custom metrics collected from Cloud Logging and processed with other metrics, please refer to the [data-processor documentation](https://github.com/azizsonawalla/repo-automation-bots/tree/documentation-1/packages/monitoring-system/data-processor#add-support-for-a-new-metric-from-an-existing-data-source)

To log a metric with field `foo` and value `bar`:

```typescript
import {logger} from 'gcf-utils'

logger.metric({foo: 'bar'})
```

## Development Setup

```sh
# Install dependencies
npm install
```

## Testing

## Contributing

If you have suggestions for how gcf-utils could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## License

Apache 2.0 © 2019 Google Inc.
