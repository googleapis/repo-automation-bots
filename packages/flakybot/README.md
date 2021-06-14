# FlakyBot

The Flaky Bot manages issues for failing tests.

* If a test fails, the bot will open an issue for it.
* If a test passes, the bot will close the corresponding issue.
* If the test fails _again_:
  * If the original issue is locked, the bot will open a new issue.
  * If the original was closed more than 10 days before, the bot will open a new
    issue.
  * Otherwise, the bot will reopen the original issue, mark it as flaky, then
    stop commenting and leave it up to a human to close.
* If someone closes a flaky issue and the test fails _again_, the bot will
  reopen the issue or open a new one, depending on the issue state/age.
* If the bot opens duplicate issues (sorry!), it will close the duplicates
  during the next run.
* If 10 or more tests fail in the same package, they will all be grouped into a
  single issue. If there are already open issues for tests in the package, they
  will be left open until the corresponding test passes.

  Note: the "package" is the part of the issue title before the `:`. If the
  package is wrong, please file an issue.

Issues or feature requests? Please
[file them on this repo](https://github.com/googleapis/repo-automation-bots/issues/new).

## Usage

### General

* Add the `flakybot: quiet` label to tell the bot to comment less on a
  particular issue.
* If a test is detected as flaky, the bot will add the `flakybot: flaky` label,
  leave the issue open and stop commenting. A human will then have to fix and
  close the issue.

### Installation

1. Install the bot on your repo. See https://github.com/apps/flaky-bot/.
   Issues will not start being filed until you finish the rest of the steps.

   **Note**: if your repo is in `googleapis`, the bot is already installed.
1. Create `sponge_log.xml` xUnit XML files with your test results. There can be
   more than one, they can be in multiple directories, and the file names must
   end with `sponge_log.xml`.
1. If you're _not_ already using Trampoline, add the Trampoline `gfile`
   directory to your Kokoro job. This contains the `flakybot` binary and service
   account that will be used to publish the logs.

   ```
   gfile_resources: "/bigstore/cloud-devrel-kokoro-resources/trampoline"
   ```
1. Call the `flakybot` binary for nightly/continuous tests you want issues
   filed for.
   When you first add the bot, you may want to call the binary from the PR and
   confirm the bot works. If it doesn't work, file an issue on this repo with a
   link to the PR & test logs.

   ```bash
   if [[ $KOKORO_BUILD_ARTIFACTS_SUBDIR = *"continuous"* ]]; then
     chmod +x $KOKORO_GFILE_DIR/linux_amd64/flakybot
     $KOKORO_GFILE_DIR/linux_amd64/flakybot
   fi
   ```

   * The path can either be `linux_amd64/flakybot`, `darwin_amd64/flakybot`, or
     `windows_amd64/flakybot.exe`.

     File an issue and/or send a PR to update the `Makefile` if you need a
     different platform.
   * Flags:
      * **`-repo`**: The repo is automatically detected from either
        `KOKORO_GITHUB_COMMIT_URL` or `KOKORO_GITHUB_PULL_REQUEST_URL`. If those
        variables are not available, you must set the `-repo` flag.
        If your repo is
        `github.com/GoogleCloudPlatform/golang-samples`, set `-repo` to
        `GoogleCloudPlatform/golang-samples`.
      * **`-installation_id`**: If your repo is not part of `googleapis` or
        `GoogleCloudPlatform`, you must set `-installation_id` to the
        GitHub installation ID from step 1.
      * **`-commit_hash`**: The commit hash is used as a unique identifier for
        test invocations. If a test passes _and fails_ for the same commit, it
        will be marked as flaky. The commit is automatically detected from the
        `KOKORO_GIT_COMMIT` environment variable. If that is not set, you must
        set `-commit_hash` to the commit this build is for.
      * **`-logs_dir`**: By default, the `flakybot` binary looks in the current
        working directory for log files (`"."`).
        If your logs are in a different directory, set `-logs_dir` to the
        absolute path to that directory. The directory is recursively searched.
      * **`-service_account`**: By default, the `flakybot` binary looks in the
        `KOKORO_GFILE_DIR` for the Trampoline service account. If that is not
        available (either you're running locally or not using Trampoline), you
        can set `-service_account` to the path to a service account that has
        Pub/Sub publish access to the `repo-automation-bots` topic
        `passthrough`.
      * **`-build_url`**: By default, the `flakybot` binary uses the
        `KOKORO_BUILD_ID` environment to detect the build URLs for the build. If
        the build is not on Kokoro, use the `-build_url` flag.
        \[Markdown\](links) are accepted.
1. Trigger a build and check the logs to make sure everything is working.

### Configuration

By default, flakybot will create issues with `priority: p1` label. You
can configure the priority in the configuration file at
`.github/flakybot.yaml`.

Here is an exmaple of changing the label to `priority: p2`.

```yaml
issuePriority: p2
```


## Contributing

Instructions are provided in [googleapis/repo-automation-bots](https://github.com/googleapis/repo-automation-bots/blob/master/README.md) for deploying and testing your bots.

This bot uses nock for mocking requests to GitHub, and snap-shot-it for capturing responses; This allows updates to the API surface to be treated as a visual diff, rather than tediously asserting against each field.

Running tests:

`npm run test`

To update snapshots:

`npm run test:snap`

If you have suggestions for how flakybot could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the Contributing Guide.

### flakybot.go

This command is used to make it easy for people to send logs to the Flaky
Bot (see instructions above).

To build/run it locally, clone the repo, `cd` to this directory, and run:

```bash
go build
./flakybot -repo=my-org/my-repo -installation_id=123 -project=my-project
```

To deploy the script, run:

```bash
make upload
```

This compiles the binary for the various platforms and copies them to the
Trampoline GCS directory.

## License

Apache 2.0 © 2019 Google LLC.
