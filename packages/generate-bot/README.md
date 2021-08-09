# generate-bot

> A command-line script that generates the scaffolding for a Github Probot application.
> The script will generate a working probot application that listens to Issues and PRs.

## Generate a bot

```sh
$ npm install
$ npm run compile
$ npm run generate-bot
```

## Setup

The bot will ask you four questions:

- **What is the name of the program?**
- **What is the description of the program?**
- **This package will be saved in /packages/yourProgramName unless you specify another location and directory name here relative to ${pwd} :**
- **Select a platform**

You may only use alphabetical letters, hyphens, underscores, and spaces in your answers; otherwise, the bot will ask you to attempt to answer again. You must name your bot in order to continue successfully.

## Testing

Running tests:

```sh
npm test
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
[contributing-guide]: https://github.com/googleapis/repo-automation-bots/blob/main/CONTRIBUTING.md
