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
| `primaryBranch` | The primary branch from which releases are started | `string` | detected from repository |
| `handleGHRelease` | Whether or not to tag releases on GitHub | `boolean` | `false` |
| `manifest` | Whether or not this is a manifest release | `boolean`  | `false` |
| `manifestConfig` | Path to the manifest config | `string` | `release-please-config.json` |
| `manifestFile` | Path to the manifest file | `string` | `.release-please-manifest.json` |
| `branches` | Additional release branches to track | `BranchConfiguration[]` | `[]` |

`BranchConfiguration`:

| Name                | Description                                        | Type       | Default                                                                               |
| ------------------- | -------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| `branch` | The branch from which releases are started | `string` | required |
| `handleGHRelease` | Whether or not to tag releases on GitHub | `boolean` | `false` |
| `manifest` | Whether or not this is a manifest release | `boolean`  | `false` |
| `manifestConfig` | Path to the manifest config | `string` | `release-please-config.json` |
| `manifestFile` | Path to the manifest file | `string` | `.release-please-manifest.json` |

#### Using a manifest config

We highly recommend using a manifest to configure your repository as the newest features
will only be configurable there. To configure a manifest, create a `release-please-config.json`
and a `.release-please-manifest.json` in the root of the repository.

The `release-please-config.json` contains the configuration for all modules in the
repository. If you are converting from configurations in the `release-please.yml`, then
you likely only have a single component in the repository. In this case, you will configure
a single package path with `.`.

Example:

```json
{
  "release-type": "node",
  "packages": {
    ".": {}
  }
}
```

The `.release-please-manifest.json` contains a mapping of paths to the current version (latest
release of your artifact).

Example:

```json
{
  ".": "1.2.3"
}
```

For more information on manifest configurations, see the [documentation][manifest-docs].

#### Validating the configuration

If the bot is installed, it will create a failing GitHub check on any pull request that
modifies the `.github/release-please.yml` config file. It will validate both the yaml config
([schema]) and the manifest config ([schema][manifest-config-schema]) if you are using a
manifest config.

#### Deprecated Options

The following options are still supported, but can also be configured in a manifest configuration file.
Future configuration options will only be available in a manifest configuration file. Note that the
configuration names are often the "dasherized" versions of these camel-cased names.

| Name                | Description                                        | Type       | Default                                                                               |
| ------------------- | -------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| `releaseLabels` | List of labels to add to the release PR. | `string[]` | `null` |
| `releaseType` | Release strategy | `string` | strategy detected from the repository's primary language |
| `versioning` | Versioning strategy | `string` | `default` |
| `bumpMinorPreMajor` | Bump minor for breaking changes before GA | `boolean` | default from underlying release strategy |
| `bumpPatchForMinorPreMajor` | Bump patch for feature changes before GA | `boolean` | default from underlying release strategy |
| `packageName` | The name of the package to publish to publish to an upstream registry such as npm. | `string` | the repository name |
| `path` | Create a release from a path other than the repository's root | `string` | the repository root |
| `changelogHost` | Override the host for the git source | `string` | `https://github.com` |
| `changelogPath` | Path to the changelog to write releases notes to when creating a release | `string` | `CHANGELOG.md` |
| `changelogType` | Strategy for generating the changelog entries. One of `default` or `github` | `string` | `default` |
| `extraFiles` | Additional files to track (if language supports it) | `string[]` | `[]` |
| `versionFile` | Path to the version file (if language supports it) | `string` | |
| `branches` | Additional release branches to track | `BranchConfiguration[]` | `[]` |
| `releaseLabel` | The label applied to pull request after creating the GitHub release | `string` | release-please default (`autorelease: tagged`) |
| `draft` | Whether to create the release as a draft | `boolean` | `false` |
| `draftPullRequest` | Whether to create the pull request as a draft | `boolean` | `false` |
| `pullRequestTitlePattern` | Customize the pull request title | `string` | |
| `monorepoTags` | Whether to include the component name in the release | `boolean` | `false` |

`BranchConfiguration`:

| Name                | Description                                        | Type       | Default                                                                               |
| ------------------- | -------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| `releaseLabels` | List of labels to add to the release PR. | `string[]` | `null` |
| `releaseType` | Release strategy | `string` | strategy detected from the repository's primary language |
| `versioning` | Versioning strategy | `string` | `default` |
| `bumpMinorPreMajor` | Bump minor for breaking changes before GA | `boolean` | default from underlying release strategy |
| `bumpPatchForMinorPreMajor` | Bump patch for feature changes before GA | `boolean` | default from underlying release strategy |
| `packageName` | The name of the package to publish to publish to an upstream registry such as npm. | `string` | the repository name |
| `path` | Create a release from a path other than the repository's root | `string` | the repository root |
| `changelogHost` | Override the host for the git source | `string` | `https://github.com` |
| `changelogPath` | Path to the changelog to write releases notes to when creating a release | `string` | `CHANGELOG.md` |
| `changelogType` | Strategy for generating the changelog entries. One of `default` or `github` | `string` | `default` |
| `extraFiles` | Additional files to track (if language supports it) | `string[]` | `[]` |
| `versionFile` | Path to the version file (if language supports it) | `string` | |
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
[schema]: https://github.com/googleapis/repo-automation-bots/blob/main/packages/release-please/src/config-schema.json
[manifest-config-schema]: https://github.com/googleapis/release-please/blob/main/schemas/config.json
[manifest-docs]: https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md
