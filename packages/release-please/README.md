# release-please

> A GitHub App built with [Probot](https://github.com/probot/probot) that proposes releases based on
> semantic version commits defined by conventionalcommits.org.

This bot wraps the [release-please][release-please] [npm package][npm-package]
to provide an easy way to integrate with your GitHub repository.

## Setup

```sh
# Install dependencies
npm install

# Run the bot
npm start
```

### Configuration

To configure the bot, you can create a configuration file:
`.github/release-please.yml`. The contents of this file allow for the following
options:

| Name                | Description                                        | Type       | Default                                                                               |
| ------------------- | -------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| `primaryBranch`     | The primary branch from which releases are started | `string`   | `master`                                                                              |
| `releaseLabels`     | List of labels to add to the release PR.           | `string[]` | `null`                                                                                | `undefined` |
| `releaseType`       | Release strategy                                   | `string`   | strategy detected from the repository's primary language                              |
| `handleGHRelease`   | Release to GitHub                                  | `boolean`  | should release please create a GitHub release, when release pull-requests are merged? |
| `bumpMinorPreMajor` | Bump minor for breaking changes before GA          | `boolean`  | whether to bump a minor version before 1.0.0 on a breaking change                     |

## Testing

This bot uses [nock](https://www.npmjs.com/package/nock) for mocking requests
to GitHub, and [snap-shot-it](https://www.npmjs.com/package/snap-shot-it) for
capturing responses; This allows updates to the API surface to be treated as a
visual diff, rather than tediously asserting against each field.

Running tests:

```sh
npm run test
```

To update snapshots:

```sh
npm run test:snap
```

## Contributing

If you have suggestions for how release-please could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## License

Apache 2.0 © 2019 Google Inc.

[release-please]: https://github.com/googleapis/release-please
[npm-package]: https://www.npmjs.com/package/release-please
