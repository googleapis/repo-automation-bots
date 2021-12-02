## Owl Bot Post Processor

Runs a docker container, defined in `OwlBot.yaml`, container as a postprocessing
step when a pull request is opened.

## Why?

The [Yoshi team](https://github.com/orgs/googleapis/teams/yoshi) at Google
is tasked with enforcing a common look and feel
all libraries in
[googleapis](https://github.com/googleapis).

The [Yoshi team](https://github.com/orgs/googleapis/teams/yoshi) creates a maintains a post processor for each language.  Depending on the language, the post processor may:

* Generate an updated `README.md` when new samples are added to a repository.
* Update the product documentation link in `README.md`, when
  `.repo-metadata.json` is updated.
* Reformat the code to conform to our lint standards.

## Owl Bot runs automatically.

Changes that do not conform to 
[Yoshi team](https://github.com/orgs/googleapis/teams/yoshi)'s standards can't be
merged, because Owl Bot runs the corresponding post processor on every
pull request to a repo with an `.OwlBot.yaml` file.  It
adds commits directly to the pull request.

## Owl Bot keeps undoing my change.  How do I make it stop?

Owl Bot is an automaton enforcing the will of the
[Yoshi team](https://github.com/orgs/googleapis/teams/yoshi).
If you absolutely cannot live with the changes made by Owl Bot,
contact yoshi team via the Google chat room **GitHub Automation**.
Non-Googlers can open an issue on this repository.

There are a few [exceptional cases](https://github.com/googleapis/synthtool/issues/1121) where the Owl Bot post processor is misbehaving
and must be silenced.  In such cases, add the label `owlbot:ignore` and
Owl Bot will stop touching the pull request.

## For Yoshi Team Members

The following sections are internal details for Yosh Team members.
### How it works

1. The post processing bot runs `cloud-build/update-pr.yaml` on Cloud Build,
injecting the following substitutions:

* `_REPOSITORY`: The name of the forked repository (_may differ from base_).
* `_PR`: The pull request number
* `_PR_BRANCH`: The branch that a PR has been created from.
* `_PR_OWNER`: The owner of the PR's repo (e.g. 'googleapis' in 'https://github.com/googleapis/synthtool')
* `_PR_USER`: The user creating the PR.
* `_GITHUB_TOKEN`: [a short-lived GitHub JWT](https://docs.github.com/en/free-pro-team@latest/developers/apps/authenticating-with-github-apps).
* `_CONTAINER`: The docker container to run (loaded from `.github/OwlBot.yaml`).
* `_DEFAULT_BRANCH`: The default branch of the repository

2. The appropriate repository and branch are cloned to a working directory.
3. Any changes made relative to the working directory are pushed back to
  the PR that triggered the OwlBot Post Processor.

### Running as a CLI

During development, I have been running the OwlBot Post Processor as a command
line application.

To do the same, from `packages/owl-bot` run:

```
npm link .
owl-bot trigger-build --help
```
