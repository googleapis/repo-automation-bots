# merge-queue

This is a small bot for managing merge queue for repositories.

## How to use

Add `merge-queue:add` label to PRs you want to automatically merge. The bot will
put the pull requests in a queue and try to merge them in order. This bot is
especially useful if you configure pull requests need to be up to date before
merge.


## Deploying and testing

Instructions are provided in [googleapis/repo-automation-bots](https://github.com/googleapis/repo-automation-bots/blob/main/README.md) for deploying and testing your bots.

## Running tests:

`npm test`

## Contributing

If you have suggestions for how merge-queue could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the Contributing Guide.

License
Apache 2.0 © 2022 Google LLC.
