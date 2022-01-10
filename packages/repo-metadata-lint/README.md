# repo-metadata-lint

Validates the fields in `.repo-metadata.json`:

* opening tracking bugs for corrupt `.repo-metadata.json` files.
* adding a failing check to PRs that corrupt `.repo-metadata.json`.

Follow [this link](https://github.com/apps/repo-metadata-lint) to install
the GitHub application.

## Checks

* `library_type` field is present.
* `release_level` field is present.
* `client_documentation` field is present.
* `api_shortname` is present, if `library_type` one of `GAPIC_AUTO`, `GAPIC_MANUAL`, `AGENT`, `GAPIC_COMBO`.
* `api_shortname` matches one of domain prefixes populated by [googleapis-api-index-generator](https://github.com/googleapis/googleapis-api-index-generator).

## Running tests:

`npm run test`

> Note: a CLI is provided in this repository for testing functionality, during development it's easiest to perform integration testing using the command line.

## Contributing

If you have suggestions for how auto-label could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the Contributing Guide.

## License

Apache 2.0 © 2019 Google LLC.
