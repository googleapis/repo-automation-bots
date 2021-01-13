## OwlBot Post Processor

Run postprocessing steps when PRs are created, performing actions such as
running template generation.

## TODO

### Cloud Build Job

- Clone appropriate repository.
- Invoke docker image described in `OwlBot.yaml`:
  - _we can start with a HelloWorld image._
- Use git to update existing PR, see: https://github.com/googleapis/synthtool/blob/master/.kokoro-autosynth/build.sh
- Update PR with success or failure, depending on outcome.

### Substitution Variables

* `_REPOSITORY`: repository to run post-processor against.
* `_OWNER`: owner of repository.
* `_PR`: to apply post processing against.
* `_PR_BRANCH`: the branch the PR has been created from.
* `_PR_USER`: the user creating the PR.
* `_PR_REPOSITORY`: the repository that the PR was created from.
* `_GITHUB_TOKEN`: [Short-lived GitHub JWT](https://docs.github.com/en/free-pro-team@latest/developers/apps/authenticating-with-github-apps).
* `_CONTAINER`: The docker container to run.
