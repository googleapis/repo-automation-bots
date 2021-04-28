# snippet-bot

Instructions are provided in [googleapis/repo-automation-bots](https://github.com/googleapis/repo-automation-bots/blob/master/README.md) for deploying and testing your bots.

## Required permission
This bot needs read/write permissions on PRs, Issues and Checks. Also make sure that the bot is listening to webhooks for PRs and Issues.

- Read/Write permission on:
  - PRs
  - Issues
  - Checks
- Listening to events:
  - PRs
  - Issues
  - Issue comment

After installing the bot, you have to have `.github/snippet-bot.yml` for actually enabling it.

This bot uses nock for mocking requests to GitHub, and snap-shot-it for capturing responses; This allows updates to the API surface to be treated as a visual diff, rather than tediously asserting against each field.

Currently, the bot does 2 things.

## Checks on PRs
For PRs, the bot detects mismatched region tags by regex for changed
files and report the status as Github Check.

For example, the following code:

```python
# [START hello]
print "Hello"
# [START hello]
# [END hello]

# [START world]
print "World"
# [END lol]
```

will result failed check with the following message:

```
test.py:5, tag hello has already started
test.py:10, tag lol doesn't have a matching start tag
test.py:8, tag world doesn't have a matching end tag
```

The bot also create failing status check when the config file doesn't
match the schema.

## Comment on PRs

The bot adds a comment summarizing changes w.r.t region tags in the
current PR.

## Refreshing on PRs

You can add `snippet-bot:force-run` label on PRs, or check a checkbox
at the end of the comment for refreshing the result made by the bot.

## Full scan
If you open an issue with `snippet-bot full scan` in its title, the
bot will scan all the files in the repo and update the issue with the
result.

## Configuration:
You can specify `ignoreFiles` and `alwaysCreateStatusCheck` in
`.github/snippet-bot.yml`. Here is an example:

```yaml
ignoreFiles:
  - packages/snippet-bot/README.md
  - "**/__snapshot__/*.js"
```

* `ignoreFiles`
  A list of glob patterns for ignoring files.
* `alwaysCreateStatusCheck`
  If set to `true`, snippet-bot will always create status checks.

## Running tests:

`npm run test`

## To update snapshots:

`npm run test:snap`

## Environment variables for local development

- `DEVREL_SETTINGS_BUCKET`: specify the bucket name for external json
  files, defaults to `devrel-prod-settings`.

## Contributing

If you have suggestions for how snippet-bot could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the Contributing Guide.

License
Apache 2.0 © 2020 Google LLC.
