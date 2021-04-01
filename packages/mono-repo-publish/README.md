# Mono-repo-publish

Mono-repo-publish is a tool that detects updates from release pull requests and determines which submodules to publish to npm.

## Usage

```
npm i mono-repo-publish -g
mono-repo-publish --help
``` 

 or 

`npx mono-repo-publish --help`

## Arguments

| argument          | description
|-------------------|---------------------------------------------------------|
| `pr-url`          | [A url to a release pull-request](https://github.com/googleapis/release-please#whats-a-release-pr) |
| `dry-run`         | [Run publish as `npm publish --dry-run`](https://docs.npmjs.com/cli/v7/commands/npm-publish) |

## Environment Variables

| argument                 | description
|--------------------------|---------------------------------------------------------|
| `APP_ID_PATH`            | The path to the APP ID of the [Github Application](https://docs.github.com/en/developers/apps/authenticating-with-github-apps) |
| `INSTALLATION_ID_PATH`   | The path to the Installation ID of the Github Application|
| `GITHUB_PRIVATE_KEY_PATH`| The path to the Private Key of the Github Application |

## License

Apache Version 2.0

