## OwlBot Post Processor

Runs a docker container, defined in OwlBot.yaml, container as a postprocessing
step when a pull request is opened.

## Why?

The post processing step allows for generted files to be populated as pull
requests are created, without requiring contributors to run an addition step.

*Examples:*

* Generating an updated `README.md` when new samples are added to a repository.
* Updating the product documentation link in `README.md`, when
  `.repo-metadata.json` is updated.

## How it works

1. The post processing bot runs `cloud-build/update-pr.yaml` on Cloud Build,
injecting the following substitutions:

* `_REPOSITORY`: The name of the forked repository (_may differ from base_).
* `_PR_BRANCH`: The branch that a PR has been created from.
* `_PR_USER`: The user creating the PR.
* `_GITHUB_TOKEN`: [a short-lived GitHub JWT](https://docs.github.com/en/free-pro-team@latest/developers/apps/authenticating-with-github-apps).
* `_CONTAINER`: The docker container to run (loaded from `.github/OwlBot.yaml`).

2. The appropriate repository and branch are cloned to a working directory.
3. Any changes made relative to the working directory are pushed back to
  the PR that triggered the OwlBot Post Processor.

## Running as a CLI

During development, I have been running the OwlBot Post Processor as a command
line application.

To do the same, from `packages/owl-bot-post-processor` run:

```
npm link .
owl-bot-post-processor trigger-build --help
```

## Contributing

If you have suggestions for how release-please could be improved, or want to
report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## License

Apache 2.0 © 2021 Google Inc.
