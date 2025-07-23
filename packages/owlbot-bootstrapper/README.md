# ⛔️ DEPRECATED : owlbot-bootstrapper

This bot is deprecated and is planned for an internal replacement in the near future.

---

Googleapis-bootstrapper is a Github bot that generates minimal files required to initialize googleapis libraries.

The bot is divided into 3 parts: a Docker container (in common-container) that runs the actual processing logic; an app that responds to github webhook events; and a CLI tool that runs a Build file that runs the container.

Instructions are provided in [googleapis/repo-automation-bots](https://github.com/googleapis/repo-automation-bots/blob/main/README.md) for deploying and testing your bots.

This bot uses nock for mocking requests to GitHub. 

## Running tests:

`npm test`

## Contributing

If you have suggestions for how googleapis-bootstrapper could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the Contributing Guide.

License
Apache 2.0 © 2021 Google LLC.