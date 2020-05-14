# generate-bot

> A command-line script that generates the scaffolding for a Github Probot application. 
> The script will generate a working probot application that listens to Issues and PRs.

## Install dependencies

Run ```npm install``` at the packages/ directory level. 

## Run the bot

```npm run generate-bot```

## Setup

The bot will ask you three questions: 

### What is the name of the program?
### What is the description of the program?
### This package will be saved in /packages/yourProgramName unless you specify another location and directory name here relative to ${pwd} :

You may only use alphabetical letters, hyphens, underscores, and spaces in your answers; otherwise, the bot will ask you to attempt to answer again. You must name your bot in order to continue successfully.

## Testing

This bot uses [snap-shot-it][snap-shot-it] for capturing responses; This allows
updates to the API surface to be treated as a visual diff, rather than tediously
asserting against each field.

Running tests:

```sh
npm run test
```

To update snapshots:

```sh
npm run test:snap
```

## Contributing

If you have suggestions for how generate-bot could be improved, or want
to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide][contributing-guide].

## License

Apache 2.0 © 2019 Google Inc.

[probot]: https://github.com/probot/probot
[github-app-link]: https://github.com/apps/license-header-lint-gcf
[nock]: https://www.npmjs.com/package/nock
[snap-shot-it]: https://www.npmjs.com/package/snap-shot-it
[contributing-guide]: https://github.com/googleapis/repo-automation-bots/blob/master/CONTRIBUTING.md
