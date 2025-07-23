# ⛔️ DEPRECATED : Release Trigger

This bot is deprecated and is planned for shutdown August 6, 2025.

Release triggering has migrated internally.

---

A GitHub app to help trigger Google releases.

## Setup

```sh
# Install dependencies
npm install

# Run the bot
npm start
```

### Configuration

To enable and configure the bot, you must create a configuration file:
`.github/release-trigger.yml`. The contents of this file allow for the following
options:

| Name           | Description                                                            | Type     | Default     |
| -------------- | ---------------------------------------------------------------------- | -------- | ----------- |
| `enabled`      | Whether this bot should run                                            | `string` | `true`      |
| `multiScmName` | If set, trigger the job as a `multi_scm` with this value as the `name` | `string` | `undefined` |
| `triggerWithoutPullRequest` | Trigger a release even when there's no corresponding release-please pull request | `boolean`| `false`    |
| `lang` | The programming language whose publishing pipeline to invoke.  Required when triggerWithoutPullRequest is true. | `string` | `undefined` |

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

If you have suggestions for how release-trigger could be improved, or want to
report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](../../CONTRIBUTING.md).

## License

Apache 2.0 © 2021 Google LLC
