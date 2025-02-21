# canary-bot

Instructions are provided in [googleapis/repo-automation-bots](https://github.com/googleapis/repo-automation-bots/blob/main/README.md) for deploying and testing your bots.

This bot provides a testing ground for changes to other bots. Principally, it allows us to test and deploy changes to gcf-utils and other harness frameworks before deploying it to our bots.

To setup env run the following commands:

`
export PROJECT_ID=repo-automation-bots 
`

`
export BOT_NAME=canary_bot 
`

`
export BOT_LOCATION=us-central1
`

The bot's only functionality is to respond to an issue in which the title includes 'canary-bot test' with the bots list of current dependencies.  
So once you have it started go to the repo-automation-bots and open an issue with that title, you should automatically see updated comments. [Example](https://github.com/googleapis/repo-automation-bots/issues/5672).
You do not need to take any action except start the bot.

## Running tests:

`npm test`

## Contributing

If you have suggestions for how canary-bot could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the Contributing Guide.

License
Apache 2.0 © 2019 Google LLC.