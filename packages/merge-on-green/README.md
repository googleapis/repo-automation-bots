# merge-on-green

Instructions are provided in [googleapis/repo-automation-bots](https://github.com/googleapis/repo-automation-bots/blob/master/README.md) for deploying and testing your bots.

This bot uses nock for mocking requests to GitHub.

## Running tests:

`npm run test`

## Installing:

`npm i`

## How it works

Once installed, this bot merges PRs once reviews have been approved and tests have passed. Briefly speaking, the bot does the following:

  - User kicks off a PR, adds an ‘automerge’ label
  - Bot listens to PR and checks to see if appropriate label was added. If so, the PR info is added to Datastore as an entry
  - *A cron job will run the logic below every four minutes, until it hits two hours. Once it hits two hours, the job will pass in a status called ‘stop’, which the logic will then use to determine an outcome*
  - Merge-on-green begins by checking if there are any reviews on the bot. If there are any non-approved reviews, assigned reviews that have not been fulfilled, or if no one has reviewed the PR, the bot will fail its check  
  - Merge-on-green then checks to see if there is at least one commit in the PR, if the PR has an ‘automerge’ label (i.e., if the user has removed it)
  - Merge-on-green will then see what checks are required by individual languages according to the file googleapis/sloth/required-checks.json, and will map the repo to the language using the sloth.json file. If any repo has any special requirements for status checks, it should note them in the required-checks.json file
  - Merge-on-green will look for the required checks in the statuses that have run. If it can’t find a given check in the statuses, it will also check under ‘check runs’ as github has two concepts to describe status checks. If it cannot find them,or if any has failed, MOG will fail the Status Check
  - Three statuses that can result:
    - Success: Merge
      - If all steps above come out as ‘true’, the bot will update the branch the PR was called from, merge the PR, and remove the Datastore entry so that the bot no longer tries to merge that PR
    - Fail: Keep Checking
      - If one of the steps fail, then the Datastore entry will remain, and the bot will keep checking the variables above until they become true or the cron job times out
    - Fail: Delete
      - Once the cron job times out, it will pass a ‘stop’ state to the logic above. If this flag is set to ‘stop’, the bot will post a failed check-run on the PR and ask the user to try again. The bot will also delete the entry from Datastore so it does not keep checking the logic


## Contributing
If you have suggestions for how merge-on-green could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the Contributing Guide.

License
Apache 2.0 © 2019 Google LLC.