# release-brancher

This project is designed to be a CLI for branching new release branches. A "release branch" is a protected branch
that is configured for release automation.

## Installation

You will want to install this library as a globally-available, standalone binary.

`npm i @google-cloud/release-brancher -g`

## Usage

You will need a personal access token with write access to the target repository.
We advise setting the `GITHUB_TOKEN` environment variable before running the binary.
Alternatively, you can provide the token via the `--github-token` command line argument.

```bash
export GITHUB_TOKEN=<your-token-here>
release-brancher create-pull-request --branch-name="1.x" \
  --target-tag="v1.3.0" --repo="googleapis/java-asset"
```

This command will:

1. Create a new branch (if necessary), branched from the specified target tag
2. Create a pull request to the default branch that
  * Adds release-please configuration for the new branch
  * Sets up branch protection for the new branch

### Options

| Option | Description | Default |
| ------ | ----------- | ------- |
| branch-name | Name of the new release branch | *Required* |
| target-tag | Tag of release to branch from | *Required* |
| repo | Repository slug (owner/repo) | *Required* |
| github-token | Personal access token. Can alternatively be set via the `GITHUB_TOKEN` environment variable | *Required* |
| release-type | release-please strategy to set | Detected from the primary branch's release-please configuration |

## Running tests:

`npm test`

## Contributing

If you have suggestions for how `release-brancher` could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the Contributing Guide.

License
Apache 2.0 © 2021 Google LLC.
