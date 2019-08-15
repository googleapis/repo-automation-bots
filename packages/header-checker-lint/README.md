# header-checker-lint

> A GitHub App built with [Probot][probot] that ensures source files contain a
valid license header.

## Installation

You can install this bot [from GitHub][github-app-link].

### Configuration

To configure the bot, you can create a configuration file:
`.bots/header-checker-lint.json`. The contents of this file define a JSON object
with the following options:

| Name | Description | Type | Default |
|----- | ----------- | ---- | ------- |
| `allowed_copyright_holders` | List of allowed copyright holders | `string[]` | `[]` |
| `allowed_license` | The allowed license. This is **not** currently validated. | "Apache-2.0", "MIT | any |
| `source_file_extensions` | List of file extensions that will be treated as source files | `string[]` | `["ts", "js", "java"]` |
| `ignore_files` | List of files to ignore. These values will be treated as path globs | `string[]` | `[]` |

## Development

### Setup

```sh
# Install dependencies
npm install

# Run the bot
npm start
```

### Testing

This bot uses [nock][nock] for mocking requests
to GitHub, and [snap-shot-it][snap-shot-it] for capturing responses; This allows
updates to the API surface to be treated as a visual diff, rather than tediously
asserting against each field.

Running tests:

```sh
npm run test
```

To update snapshots:

```sh
npm run test:snap
```

### Contributing

If you have suggestions for how header-checker-lint could be improved, or want
to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide][contributing-guide].

## License

Apache 2.0 © 2019 Google Inc.

[probot]: https://github.com/probot/probot
[github-app-link]: https://github.com/apps/license-header-lint-gcf
[nock]: https://www.npmjs.com/package/nock
[snap-shot-it]: https://www.npmjs.com/package/snap-shot-it
[contributing-guide]: https://github.com/googleapis/repo-automation-bots/blob/master/CONTRIBUTING.md