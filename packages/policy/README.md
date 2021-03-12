# policy-bot
Policy Bot validates settings on given GitHub repositories, and saves the results.


## Testing & deployment
Instructions are provided in [googleapis/repo-automation-bots](https://github.com/googleapis/repo-automation-bots/blob/master/README.md) for deploying and testing your bots.

This bot uses nock for mocking requests to GitHub, and snap-shot-it for capturing responses; This allows updates to the API surface to be treated as a visual diff, rather than tediously asserting against each field.

## Running as a local CLI
For local testing purposes, you may want to check the policy of a single repository, or do a policy check on a collection of repositories.  You can do this locally, without waiting for the bot cron to complete.  In a directory with the cloned repository:

```
cd packages/policy
npm install
npm link
```

Make sure to set the `GITHUB_TOKEN` environment variable to use a personal access token which has the requisite permissions for the repositories you'd like to check.

You can now run the `policy` command, and check a single repo:
```
policy --repo googleapis/nodejs-storage
```

Or you can pass a search filter:
```
policy --search 'org:googleapis is:public archived:false'
```

*note: The branch protection check requires a personal access token which has administrative rights on the repository. Please use these types of tokens with care*.

## Running tests:

`npm test`

## Contributing

If you have suggestions for how policy could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the Contributing Guide.

License
Apache 2.0 © 2019 Google LLC.
