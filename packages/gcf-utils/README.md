# gcf-utils

> Helper module to make [Probot](https://github.com/probot/probot) applications easier and more secure to run in Google Cloud Functions

## Usage

### GCFLogger

`GCFLogger` is a standardized logger for Google Cloud Functions. Note: this logger is a singleton

```
import {getLogger} from 'gcf-utils';

let logger = getLogger();

logger.info('An info message');
logger.debug({ 'debug-property': 'value' });
logger.metric({ 'metric-property': 'value' });
```

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
