# Buildcop

The Build Cop Bot manages issues for failing tests.

* If a test fails, the bot will open an issue for it.
* If a test passes, the bot will close the corresponding issue.
* If the test fails _again_, the bot will reopen the issue, mark it as flaky, then
  stop commenting and leave it up to a human to close.
* If someone closes the issue and the test fails _again_, the bot will reopen the
  issue and leave it up to a human to close again.

Issues or feature requests? Please
[file them on this repo](https://github.com/googleapis/repo-automation-bots/issues/new).

## Usage

### Installation

1. Install the bot on your repo. See https://github.com/apps/build-cop-bot/.
   Issues will not start being filed until you finish the rest of the steps.

   **Note**: if your repo is in `googleapis`, the bot is already installed.
1. Create `sponge_log.xml` xUnit XML files with your test results. There can be
   more than one, they can be in multiple directories, and the file names must
   end with `sponge_log.xml`.
1. If you're _not_ already using Trampoline, add the Trampoline `gfile`
   directory to your Kokoro job. This contains the `buildcop` binary that
   will be used to publish the logs.

   ```
   gfile_resources: "/bigstore/cloud-devrel-kokoro-resources/trampoline"
   ```
1. Call the `buildcop` binary for nightly/continuous tests you want issues
   filed for.
   When you first add the bot, you may want to call the binary from the PR and
   confirm the bot works. If not, file an issue on this repo with a link to the
   PR & test logs.

   ```bash
   if [[ $KOKORO_BUILD_ARTIFACTS_SUBDIR = *"continuous"* ]]; then
     chmod +x $KOKORO_GFILE_DIR/linux_amd64/buildcop
     $KOKORO_GFILE_DIR/linux_amd64/buildcop
   fi
   ```

   * The path can either be `linux_amd64/buildcop`, `darwin_amd64/buildcop`, or
     `windows_amd64/buildcop.exe`.

     File an issue and/or send a PR to update the `Makefile` if you need a
     different platform.
   * Flags:
      * **`-repo`**: The repo is automatically detected from the Kokoro build
        environment. If the detection doesn't work, you may need to set the
        `--repo` flag. If your repo is
        `github.com/GoogleCloudPlatform/golang-samples`, set `-repo` to
        `GoogleCloudPlatform/golang-samples`.
      * **`-installation_id`**: If your repo is not part of `googleapis` or
        `GoogleCloudPlatform`, you must set `-installation_id` to the
        GitHub installation ID from step 1.
      * **`-logs_dir`**: By default, the `buildcop` binary looks in the current
        working directory for log files (`"."`).
        If your logs are in a different directory, set `-logs_dir` to the
        absolute path to that directory. The directory is recursively searched.
1. Trigger a build and check the logs to make sure everything is working.

## Contributing

Instructions are provided in [googleapis/repo-automation-bots](https://github.com/googleapis/repo-automation-bots/blob/master/README.md) for deploying and testing your bots.

This bot uses nock for mocking requests to GitHub, and snap-shot-it for capturing responses; This allows updates to the API surface to be treated as a visual diff, rather than tediously asserting against each field.

Running tests:

`npm run test`

To update snapshots:

`npm run test:snap`

If you have suggestions for how buildcop could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the Contributing Guide.

### buildcop.go

This command is used to make it easy for people to send logs to the Build Cop
bot (see instructions above).

To build/run it locally, clone the repo, `cd` to this directory, and run:

```bash
go build
./buildcop -repo=my-org/my-repo -installation_id=123 -project=my-project
```

To deploy the script, run:

```bash
make upload
```

This compiles the binary for the various platforms and copies them to the
Trampoline GCS directory.

## License

Apache 2.0 © 2019 Google LLC.