# auto-label

The auto-label bot automatically adds labels to issues and pull requests.

Product-specific repos are always labeled with the API label for that product.

The product can also be auto-detected from the issue/PR title. The following
formats are known to work:

Issue title | Label
----------- | -----
`spanner: ignored` | `api: spanner`
`spanner/ignored` | `api: spanner`
`spanner.ignored` | `api: spanner`
`SPANNER.IGNORED` | `api: spanner`
`SPAN ner: ignored` | `api: spanner`
`ignored(spanner): ignored` | `api: spanner`
`ignored(spanner/ignored): ignored` | `api: spanner`
`ignored(/spanner/ignored): ignored` | `api: spanner`
`iot: ignored` | `api: cloudiot`

Certain prefixes of the above formats are also supported:

Issue title | Label
----------- | -----
`com.example.spanner: ignored` | `api: spanner`
`com.google.spanner.ignored: ignored` | `api: spanner`
`fix(snippets.spanner.ignored): ignored` | `api: spanner`

-------------------

Bot runs every night, when repositories are created, and when issues are created. So, wait until the next day if you just added the bot to see your issues backlabeled.

Auto-label is different from label-sync, auto-label adds labels to your issues based on the product, where label-sync cleans up labels in your repository.

Instructions are provided in [googleapis/repo-automation-bots](https://github.com/googleapis/repo-automation-bots/blob/master/README.md) for deploying and testing your bots.

This bot uses nock for mocking requests to GitHub, and snap-shot-it for capturing responses; This allows updates to the API surface to be treated as a visual diff, rather than tediously asserting against each field.

## Running tests:

`npm run test`

## To update snapshots:

`npm run test:snap`

## Contributing

If you have suggestions for how auto-label could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the Contributing Guide.

License
Apache 2.0 © 2019 Google LLC.