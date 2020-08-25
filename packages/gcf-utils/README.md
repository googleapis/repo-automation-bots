# gcf-utils

> Helper module to make [Probot](https://github.com/probot/probot) applications easier and more secure to run in Google Cloud Functions

## Usage

### GCFLogger

`GCFLogger` is a standardized logger for Google Cloud Functions.

```typescript
import {logger} from 'gcf-utils';

logger.info('An info message');
logger.debug({ 'debug-property': 'value' });
logger.metric({ 'metric-property': 'value' });
```

#### Automatically Logged Metrics

// TODO (asonawalla)

#### Manually Log Metrics

// TODO (asonawalla)

### GCFBootstrapper

TODO:(orthros)

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
