# release-trigger

A GitHub app to help trigger Google releases.

## Setup

```sh
# Install dependencies
npm install

# Run the bot
npm start
```

### Configuration

To configure the bot, you can create a configuration file:
`.github/release-trigger.yml`. The contents of this file allow for the following
options:

| Name | Description | Type | Default |
| ---- | ----------- | ---- | ------- |
| `enabled` | Whether this bot should run | `string` | `true`   

### Usage

After installing the GitHub app and creating a `.github/release-trigger.yml` configuration,
the bot should attempt to trigger releases when a GitHub release is tagged.

Workflow:

1. A GitHub release is tagged (usually by `release-please`)
2. `release-trigger` receives `release.created` event
3. `release-trigger` looks for a merged pull request tagged with `autorelease: tagged`
4. `release-trigger` triggers the release job
5. `release-trigger` adds `autorelease: triggered`
6. Release job completes and tags the pull request with `autorelease: published`.
7. `release-trigger` removes the `autorelease: triggered` and `autorelease: tagged` labels

#### Forcing the bot to run

To force a re-run, you can remove the `autorelease: triggered` label. The bot will
attempt to re-trigger the release and will re-label the pull request with
`autorelease: triggered`.

## Testing

Running tests:

```sh
npm run test
```

## Contributing

If you have suggestions for how release-please could be improved, or want to
report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](../../CONTRIBUTING.md).

## License

Apache 2.0 © 2021 Google Inc.
