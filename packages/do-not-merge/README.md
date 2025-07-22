# ⛔️ DEPRECATED : Do Not Merge

This bot is deprecated and is planned for shutdown August 4, 2025.

We suggest blocking a pull request by "Requesting Changes" when reviewing the pull request.

<details>
<summary>
Alternatively, you can easily replicate "Do Not Merge GCF"s functionality using GitHub actions.
</summary>

```
on:
  pull_request:
    types: [labeled, unlabeled]

jobs:
  check-dnm:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/github-script@v7
        if: github.event.label.name == 'do not merge' && github.event.action == 'labeled'
        with:
          script: |
            github.rest.checks.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              name: "Do Not Merge",
              head_sha: context.payload.pull_request.head.sha,
              conclusion: "failure",
              output: {
                title: "Remove the do not merge label before merging",
                summary: "Remove the do not merge label before merging"
              }
            })
      - uses: actions/github-script@v7
        if: github.event.label.name == 'do not merge' && github.event.action == 'unlabeled'
        with:
          script: |
            github.rest.checks.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              name: "Do Not Merge",
              head_sha: context.payload.pull_request.head.sha,
              conclusion: "success",
              output: {
                title: "OK to merge, label not found",
                summary: "Ok to merge, label not found"
              }
            })
permissions:
  checks: write
```
</details>

---

The Do Not Merge bot checks for the `do not merge` label on pull requests and
adds a failing PR check if it's there. The check changes to success once the
label is removed.

There is no check if the `do not merge` label is never added to the PR.

The `do-not-merge` label is treated the same way as `do not merge`.

## Configuration

To configure the bot, you can create a configuration file:
`.github/do-not-merge.yml`. The contents of this file allow for the following
options:

| Name                | Description                                        | Type       | Default                                                                               |
| ------------------- | -------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| `alwaysCreateStatusCheck` | Whether the bot should always report a status check | `boolean` | `false` |

## Development

Instructions are provided in [googleapis/repo-automation-bots](https://github.com/googleapis/repo-automation-bots/blob/main/README.md) for deploying and testing your bots.

This bot uses nock for mocking requests to GitHub, and snap-shot-it for capturing responses; This allows updates to the API surface to be treated as a visual diff, rather than tediously asserting against each field.

### Running tests:

`npm test`

### Contributing

If you have suggestions for how the Do Not Merge could be improved, or want to
report a bug, open an issue! We'd love all and any contributions.

For more, check out the Contributing Guide.
