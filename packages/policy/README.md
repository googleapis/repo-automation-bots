# policy-bot
Policy Bot validates settings on given GitHub repositories, and saves the results.  Largely based on the rules internally documented at go/cloud-dpe-oss-standards, the bot will check for the following conditions:

| Field | Description |
|-------|-------------|
| repo | The short name of the GitHub repository, not including the org/owner |
| org | The GitHub organization name of the given repository |
| topics | A list of repository topics for the given repository |
| language | Primary programming language used in the repository |
| hasRenovateConfig | Does the repository have a `renovate.json` available in the root? |
| hasValidLicense | Does the repository have a LICENSE file in an approved location, with a valid LICENSE? |
| hasCodeOfConduct | Does the repository have a CODE_OF_CONDUCT file available? |
| hasContributing | Does the repository have a CONTRIBUTING file available? |
| hasCodeowners | Does the repository have a CODEOWNERS file available? |
| hasBranchProtection | Does the repository have Branch Proection configured in a safe way? |
| hasMergeCommitsDisabled | Does the repository have merge commits disabled? |
| hasSecurityPolicy | Does the repository have a SECURITY file available? |
| timestamp | Date when the scan was run for this repository |

The bot will scan for these settings every 24 hours on all configured repositories, and write the results to a table in BigQuery.  *It is meant for Google internal use only.*

## Testing & deployment
Instructions are provided in [googleapis/repo-automation-bots](https://github.com/googleapis/repo-automation-bots/blob/master/README.md) for deploying and testing your bots.

This bot uses nock for mocking requests to GitHub, and snap-shot-it for capturing responses; This allows updates to the API surface to be treated as a visual diff, rather than tediously asserting against each field.

This bot specifically has a dependency on BigQuery. The desired schema for the BigQuery table is stored in `policy-bigquery-schema.json`, and can be re-created if needed with `bq`:

```
bq mk --table repo-automation-bots:PolicyResults.PolicyResults policy-bigquery-schema.json
```

## Running as a local CLI
For local testing purposes, you may want to check the policy of a single repository, or do a policy check on a collection of repositories.  You can do this locally, without waiting for the bot cron to complete.  In a directory with the cloned repository:

```
cd packages/policy
npm install
npm link
```

Make sure to set the `GITHUB_TOKEN` environment variable to use a personal access token which has the requisite permissions for the repositories you'd like to check.

You can now run the `policy` command, and check a single repo:
```
policy --repo googleapis/nodejs-storage
```

Or you can pass a search filter:
```
policy --search 'org:googleapis is:public archived:false'
```

*note: The branch protection check requires a personal access token which has administrative rights on the repository. Please use these types of tokens with care*.

## Running tests:

`npm test`

## Contributing

If you have suggestions for how policy could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the Contributing Guide.

License
Apache 2.0 © 2019 Google LLC.



