# snippet-bot

Instructions are provided in [googleapis/repo-automation-bots](https://github.com/googleapis/repo-automation-bots/blob/master/README.md) for deploying and testing your bots.

This bot needs read/write permissions on PRs and Checks. Also make sure that the bot is listening to webhooks for PRs.

After installing the bot, you have to have `.github/snippet-bot.yml` for actually enabling it.

This bot uses nock for mocking requests to GitHub, and snap-shot-it for capturing responses; This allows updates to the API surface to be treated as a visual diff, rather than tediously asserting against each field.

Currently, it only detects mismatched region tags by regex for changed files and report the status as Github Check.

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

## Running tests:

`npm run test`

## To update snapshots:

`npm run test:snap`

## Contributing

If you have suggestions for how snippet-bot could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the Contributing Guide.

License
Apache 2.0 © 2020 Google LLC.
