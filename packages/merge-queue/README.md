# merge-queue

This is a small bot for managing merge queue for repositories.

Once [Github's merge
queue](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)
is released and if it works for us, we may migrate to Github's merge queue and delete this bot

## How to use

Add `merge-queue:add` label to PRs you want to automatically merge. The bot will
put the pull requests in a queue and try to merge them in order. This bot is
especially useful if you configure pull requests need to be up to date before
merge.

## Security consideration

If you install this bot, please make sure that only trusted people can add a
label to a PR. If random people can add a label to a PR, they could try to merge
malicious code into your branch.

## Deploying and testing

Instructions are provided in [googleapis/repo-automation-bots](https://github.com/googleapis/repo-automation-bots/blob/main/README.md) for deploying and testing your bots.

## Running tests:

`npm test`

## Contributing

If you have suggestions for how merge-queue could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the Contributing Guide.

License
Apache 2.0 © 2022 Google LLC.
