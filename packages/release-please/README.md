# release-please

> A GitHub App built with [Probot](https://github.com/probot/probot) that proposes releases based on
> semantic version commits defined by conventionalcommits.org.

This bot wraps the [release-please][release-please] [npm package][npm-package]
to provide an easy way to integrate with your GitHub repository.

## Setup

```sh
# Install dependencies
npm install

# Run the bot
npm start
```

### Configuration

To configure the bot, you can create a configuration file:
`.github/release-please.yml`. The contents of this file allow for the following
options:

| Name                | Description                                        | Type       | Default                                                                               |
| ------------------- | -------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| `primaryBranch` | The primary branch from which releases are started | `string` | `master` |
| `releaseLabels` | List of labels to add to the release PR. | `string[]` | `null` |
| `releaseType` | Release strategy | `string` | strategy detected from the repository's primary language |
| `versioning` | Versioning strategy | `string` | `default` |
| `handleGHRelease` | Release to GitHub | `boolean` | `false` |
| `bumpMinorPreMajor` | Bump minor for breaking changes before GA | `boolean` | default from underlying release strategy |
| `bumpPatchForMinorPreMajor` | Bump patch for feature changes before GA | `boolean` | default from underlying release strategy |
| `packageName` | The name of the package to publish to publish to an upstream registry such as npm. | `string` | the repository name |
| `path` | Create a release from a path other than the repository's root | `string` | the repository root |
| `changelogPath` | Path to the changelog to write releases notes to when creating a release | `string` | `CHANGELOG.md` |
| `changelogType` | Strategy for generating the changelog entries. One of `default` or `github` | `string` | `default` |
| `manifest` | Whether or not this is a manifest release | `boolean`  | `false` |
| `manifestConfig` | Path to the manifest config | `string` | `release-please-config.json` |
| `manifestFile` | Path to the manifest file | `string` | `.release-please-manifest.json` |
| `extraFiles` | Additional files to track (if language supports it) | `string[]` | `[]` |
| `versionFile` | Path to the version file (if language supports it) | `string` | |
| `branches` | Additional release branches to track | `BranchConfiguration[]` | `[]` |
| `releaseLabel` | The label applied to pull request after creating the GitHub release | `string` | release-please default (`autorelease: tagged`) |
| `draft` | Whether to create the release as a draft | `boolean` | `false` |
| `draftPullRequest` | Whether to create the pull request as a draft | `boolean` | `false` |
| `pullRequestTitlePattern` | Customize the pull request title | `string` | |
| `monorepoTags` | Whether to include the component name in the release | `boolean` | `false |

`BranchConfiguration`:

| Name                | Description                                        | Type       | Default                                                                               |
| ------------------- | -------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| `branch` | The branch from which releases are started | `string` | required |
| `releaseLabels` | List of labels to add to the release PR. | `string[]` | `null` |
| `releaseType` | Release strategy | `string` | strategy detected from the repository's primary language |
| `versioning` | Versioning strategy | `string` | `default` |
| `handleGHRelease` | Release to GitHub | `boolean` | `false` |
| `bumpMinorPreMajor` | Bump minor for breaking changes before GA | `boolean` | default from underlying release strategy |
| `bumpPatchForMinorPreMajor` | Bump patch for feature changes before GA | `boolean` | default from underlying release strategy |
| `packageName` | The name of the package to publish to publish to an upstream registry such as npm. | `string` | the repository name |
| `path` | Create a release from a path other than the repository's root | `string` | the repository root |
| `changelogPath` | Path to the changelog to write releases notes to when creating a release | `string` | `CHANGELOG.md` |
| `changelogType` | Strategy for generating the changelog entries. One of `default` or `github` | `string` | `default` |
| `manifest` | Whether or not this is a manifest release | `boolean`  | `false` |
| `manifestConfig` | Path to the manifest config | `string` | `release-please-config.json` |
| `manifestFile` | Path to the manifest file | `string` | `.release-please-manifest.json` |
| `extraFiles` | Additional files to track (if language supports it) | `string[]` | `[]` |
| `versionFile` | Path to the version file (if language supports it) | `string` | |
| `branches` | Additional release branches to track | `BranchConfiguration[]` | `[]` |
| `releaseLabel` | The label applied to pull request after creating the GitHub release | `string` | release-please default (`autorelease: tagged`) |
| `draft` | Whether to create the release as a draft | `boolean` | `false` |
| `draftPullRequest` | Whether to create the pull request as a draft | `boolean` | `false` |
| `pullRequestTitlePattern` | Customize the pull request title | `string` | |
| `monorepoTags` | Whether to include the component name in the release | `boolean` | `false` |

### Usage

After installing the GitHub app, and creating a `.github/release-please.yml` configuration,
releases should be automatically proposed on commits to the configured branch(es).

#### Forcing the bot to run

To force a re-run, you may add the `release-please:force-run` label to *any* pull
request. The bot should respond by running and removing that label.

#### Handling GitHub releases

The bot can optionally, tag the GitHub releases after a release pull request is
merged. To do so, set `handleGHRelease` to `true` in your `.github/release-please.yml`
configuration.

## Testing

This bot uses [nock](https://www.npmjs.com/package/nock) for mocking requests
to GitHub, and [snap-shot-it](https://www.npmjs.com/package/snap-shot-it) for
capturing responses; This allows updates to the API surface to be treated as a
visual diff, rather than tediously asserting against each field.

Running tests:

```sh
npm run test
```

To update snapshots:

```sh
npm run test:snap
```

## Contributing

If you have suggestions for how release-please could be improved, or want to
report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](../../CONTRIBUTING.md).

## License

Apache 2.0 © 2019 Google Inc.

[release-please]: https://github.com/googleapis/release-please
[npm-package]: https://www.npmjs.com/package/release-please
