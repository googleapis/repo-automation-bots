# SLO Bot

Lints for slo rules (issue_slo_rules.json) file and creates a check on the PR. Comments on the PR if it is invalid.

(https://github.com/googleapis/repo-automation-bots/blob/master/README.md) for deploying and testing your bots.

This bot uses nock for mocking requests to GitHub, and snap-shot-it for capturing responses; This allows updates to the API surface to be treated as a visual diff, rather than tediously asserting against each field.

## Usage:
Create Out of SLO label in the repo. Update `slo-stat-bot.yaml` with the name of OOSLO label. 

```yaml
name: ooslo
```


Create `issue_slo_rules.json` file inside of org level or repo level .github directory. This file should consist of a list of slo rules that either applies to all of the repos under the same organization or applies to a specific repository.
## Running tests:

`npm run test`

## To update snapshots:

`npm run test:snap`

## Contributing

If you have suggestions for how slo-stat-label could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the Contributing Guide.

License
Apache 2.0 © 2019 Google LLC.