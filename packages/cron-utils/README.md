# Utility for deploying repo-automation-bot crons

This is a small utility for configuring scheduled cron tasks for
repo-automation-bots.

## Usage

### Install

```bash
npm i -g @google-automations/cron-utils
```

### Usage

This library provides a `cron-utils` binary script that deploys scheduled
triggers for `gcf-utils` based bots.

To run, call the `cron-utils` binary from the root directory of your bot.
You will need a `cron.yaml` and/or `cron` file in that directory.

```bash
cron-utils deploy \
  --scheduler-service-account=[some-service-account]@[project-name].iam.gserviceaccount.com \
  --function-region=us-central1 \
  --region=us-central1 \
  --function-name=[name of target function] \
  --project=[project-id]
```

| Option | Description | Default |
| ------ | ----------- | ------- |
| scheduler-service-account | Service account email that signs requests to the scheduler proxy | *Required* |
| function-region | Region where the function is deployed | *Required* |
| region | Region where the scheduler proxy is deployed | *Required* |
| function-name | Name of the target function/bot | *Required* |
| project | Name of the project where function and scheduler proxy are deployed | `repo-automation-bots` |

### cron.yaml

You can specify one or more cron tasks via a `cron.yaml` config file
at the root of your bot.

```yaml
cron:
- name: name of cron
  # crontab formatted schedule
  schedule: 0 1 * * *
  description: optional description
  # extra request parameters for scheduler http request
  params:
    foo: bar
```

### `cron` file (legacy)

You can specify a single cron task via a `cron` config file at the
root of your bot. The task name will default to the bot name (folder name)
and will not have a description.

The contents of the `cron` file should be a text representation of the
crontab schedule.
