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
   more than one `sponge_log.xml` file as long as they are in different
   directories. They must be named `sponge_log.xml`.
1. If you're _not_ already using Trampoline, add the Trampoline `gfile`
   directory to your Kokoro job. This contains the `buildcop.sh` script that
   will publish the logs in the next step.

   ```
   gfile_resources: "/bigstore/cloud-devrel-kokoro-resources/trampoline"
   ```
1. Call the `buildcop.sh` script for nightly/continuous tests you want issues
   filed for.

   ```bash
   if [[ $KOKORO_BUILD_ARTIFACTS_SUBDIR = *"continuous"* ]]; then
     chmod +x $KOKORO_GFILE_DIR/buildcop.sh
     $KOKORO_GFILE_DIR/buildcop.sh
   fi
   ```

   * If your repo is not part of `googleapis` or `GoogleCloudPlatform`, you must
     set the `INSTALLATION_ID` environment variable to the GitHub installation
     ID from step 1.
1. Trigger a build and check the logs to make sure the script is working.

## Contributing

Instructions are provided in [googleapis/repo-automation-bots](https://github.com/googleapis/repo-automation-bots/blob/master/README.md) for deploying and testing your bots.

This bot uses nock for mocking requests to GitHub, and snap-shot-it for capturing responses; This allows updates to the API surface to be treated as a visual diff, rather than tediously asserting against each field.

Running tests:

`npm run test`

To update snapshots:

`npm run test:snap`

If you have suggestions for how buildcop could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the Contributing Guide.

## License

Apache 2.0 © 2019 Google LLC.