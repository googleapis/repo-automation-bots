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
| 	trigger_type         | string     | Trigger source (eg. Github Webhook, Cloud Scheduler)   |                                                             |
| 	trigger_sender       | string     | GitHub username of user that triggered the webhook     | Only for GitHub WebHook triggers                            |
| 	github_delivery_guid | string     | GUID of the GitHub WebHook                             | Only for GitHub WebHook triggers and subsequent Cloud Tasks |
| 	payload_hash         | string     | An MD5 hash of the GitHub Event Payload                | Only for GitHub WebHook triggers                            |
| 	trigger_source_repo  | object     | Object containing GitHub source repository information | Only for GitHub WebHook triggers                            |
| 		owner            | string     | Username of the repository owner                       | Only for GitHub WebHook triggers                            |
| 		owner_type       | string     | The type of owner (eg. 'User' or 'Organization')       | Only for GitHub WebHook triggers                            |
| 		repo_name        | string     | The name of the GitHub repository                      | Only for GitHub WebHook triggers                            |
| 		url              | string     | URL to the GitHub repository (may be private)          | Only for GitHub WebHook triggers                            |

##### GitHub Action Information
// TODO (asonawalla)

#### Manually Log Metrics

// TODO (asonawalla)

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
