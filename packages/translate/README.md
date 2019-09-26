# Translate

> A GitHub App built with [Probot](https://github.com/probot/probot) that translates issue titles/bodies.

## Usage

When a new issue is opened, the translate bot will translate the title and body
to the configured language and comment on the issue.

### Configuration

To configure the bot, you can create a configuration file:
`.github/release-please.yml`. The contents of this file allow for the following
options:

| Name | Description | Type | Default |
|----- | ----------- | ---- | ------- |
| `repoLanguageCode` | The language code to translate to. See [language-codes] for available options | `string` | `en` |

## Setup

```sh
# Install dependencies
npm install

# Run the bot
npm start
```

## Testing

This bot uses [nock](https://www.npmjs.com/package/nock) for mocking requests
to GitHub, and [snap-shot-it](https://www.npmjs.com/package/snap-shot-it) for capturing
responses; This allows updates to the API surface to be treated as a visual diff,
rather than tediously asserting against each field.

Running tests:

```sh
npm run test
```

To update snapshots:

```sh
npm run test:snap
```

## Contributing

If you have suggestions for how conventional-commit-lint could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## License

Apache 2.0 © 2019 Google LLC

[language-codes]: https://cloud.google.com/translate/docs/languages