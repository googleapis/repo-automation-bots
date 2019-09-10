# Repo Automation Bots

A collection of bots, based on [probot](https://github.com/probot/probot), for
performing common maintenance tasks across the open-source repos managed
by Google on GitHub.

## Implemented Bots

| Name | Description | Install |
| ---- | ----------- | ------- |
| [blunderbuss] | Assigns issues and PRs randomly to a specific list of user | [install][blunderbuss-app] |
| [conventional-commit-lint] | PR checker that ensures that the commit messages follow conventionalcommits.org style | [install][conventional-commit-lint-app] |
| [license-header-lint] | PR checker that ensures that source files contain valid license headers | [install][license-header-lint-app] |

## Testing Locally

### Create a Proxy to Relay Webhooks

Visit https://smee.io/new and create a proxy for relaying webhooks to your
local web-service.

In the root directory of `repo-automation-bots`, run:

```
npm run proxy -- -u <URL-OF-PROXY>
```

### Creating the Development Application

If it's your first time running your application, you should create a new
GitHub application using the probot server:

1. `cd packages/your-bot`.
1. `npm start`.
1. visit:  http://localhost:3000

### Running Your Application

Once you've created your application, _and installed it on some of your repos_,
start probot again, setting the following environment variables:

* `APP_ID`: the ID, available in GitHub developer settings.
* `PRIVATE_KEY_PATH`: path to App's private key, download this from developer
  settings.
* `PRIVATE_KEY`: private key for application.
* `WEBHOOK_SECRET`: secret key set in GitHub developer settings.

Environment variables set, run:

1. `cd packages/your-bot`.
1. `npm start`.

### Running bots on a Cron

To run a bot on a schedule include a file in your bot's folder named `cron` whose
content is valid [unix -cron format](http://man7.org/linux/man-pages/man5/crontab.5.html).
This will create a Cloud Scheduler Job which makes requests to your endpoint
at the specified schedule.

### Publishing Utility Modules

1. create a token with Wombat Dressing Room.
2. run `npm run release`.

[blunderbuss]: https://github.com/googleapis/repo-automation-bots/tree/master/packages/blunderbuss
[blunderbuss-app]: https://github.com/apps/blunderbuss-gcf
[conventional-commit-lint]: https://github.com/googleapis/repo-automation-bots/tree/master/packages/conventional-commit-lint
[conventional-commit-lint-app]: https://github.com/apps/conventional-commit-lint-gcf
[license-header-lint]: asdf
[license-header-lint-app]: https://github.com/apps/license-header-lint-gcf
