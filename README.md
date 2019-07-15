# Repo Automation Bots

A collection of bots, based on [probot](https://github.com/probot/probot), for
performing common maintenance tasks across the open-source repos managed
by Google on GitHub.

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
