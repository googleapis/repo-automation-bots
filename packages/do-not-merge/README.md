# Do Not Merge

The Do Not Merge bot checks for the `do not merge` label on pull requests and
adds a failing PR check if it's there. The check changes to success once the
label is removed.

There is no check if the `do not merge` label is never added to the PR.

The `do-not-merge` label is treated the same way as `do not merge`.

## Development

Instructions are provided in [googleapis/repo-automation-bots](https://github.com/googleapis/repo-automation-bots/blob/main/README.md) for deploying and testing your bots.

This bot uses nock for mocking requests to GitHub, and snap-shot-it for capturing responses; This allows updates to the API surface to be treated as a visual diff, rather than tediously asserting against each field.

### Running tests:

`npm test`

### Contributing

If you have suggestions for how the Do Not Merge could be improved, or want to
report a bug, open an issue! We'd love all and any contributions.

For more, check out the Contributing Guide.
