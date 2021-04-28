# merge-on-green

Instructions are provided in [googleapis/repo-automation-bots](https://github.com/googleapis/repo-automation-bots/blob/master/README.md) for deploying and testing your bots.

This bot uses nock for mocking requests to GitHub.

### What is Merge-on-green?

[Merge-on-green](https://github.com/googleapis/repo-automation-bots/tree/master/packages/merge-on-green)
is a Probot application that automatically merges pull requests once tests have
passed for it and it has been approved.

## Installation

If you have a repository under the `googleapis` or `GoogleCloudPlatform`
organizations, you do not need to install merge-on-green. Otherwise, you can
install for your repository by following this
[link](https://github.com/apps/gcf-merge-on-green) and giving it access to your
repository.

## Usage

To use merge-on-green, simply add the `automerge` or `automerge: exact` label.
The `automerge` label blindly merges pull requests if the tests and reviews have
passed; `automerge: exact` will only merge if the review for the pull request is
for its most recent commit. If a commit is pushed to a PR after a reviewer has
approved, merge-on-green will remove the approval and will not merge the PR.
This version of the label is a more secure version of merge-on-green.

Both labels should exist on the `googleapis` and `GoogleCloudPlatform`
organizations through label-sync. If your repository is not on these
organizations, you will need to create an `automerge` and/or `automerge: exact`
label yourself.

You should see an eyes emoji react to your pull request if merge-on-green has
successfully registered it. Sometimes merge-on-green gets flooded with multiple
labels at once, and may miss certain PRs. Rest assured, merge-on-green has a
built-in mechanism to check every so often if there are any "hanging" PRs, so it
should be registered promptly. If you're feeling impatient, feel free to remove
and re-add the label to retrigger it again.

## What conditions need to be met in order for my PR to be merged?

-   You must have *at least one* required check. Otherwise, merge-on-green will
    reject the PR and comment on this issue.
-   All your REQUIRED tests need to have passed (green, not yellow!)
-   At least one *other* person (not you!) needs to have approved your PR, and
    there must be no comments/changes requested left on the PR.
-   The PR must not have any conflicts/cannot be in an unmergeable state. If the
    branch is merely behind, i.e., there's been an update to the main branch
    with no conflicts, merge-on-green will automatically update the branch for
    you and then attempt to merge.
-   The bot must have read/write access to your repository in order to merge the
    PR. You should see an appropriate comment on the PR if it does not.
-   There should be no other restrictions on merging PRs that are tighter than
    the bot's restrictions. For example, if you require PRs to be approved by
    only people within certain groups, and the approver is not within that
    group, then merge-on-green will not be able to merge the PR anyways.

## Troubleshooting: Why isn't my PR merging?

-   Do you have any required tests?
-   Have all your *required* tests passed?
-   Has someone other than yourself and with the correct permissions approved
    the PR, and no one has left comments/requested changes?
-   Does the bot have all the appropriate permissions on your PR (is your branch
    protected?) See giving push access
    [here](https://docs.github.com/en/github/administering-a-repository/about-protected-branches)
-   Are there any other restrictions on your branch to merge a PR?
-   Have two minutes since the last test and approval passed? The bot runs on a
    2-min cron job.

## Running tests:

`npm run test`

## Installing locally:

`npm i`

## Still here? Learn about the logic!

Once installed, this bot merges PRs once reviews have been approved and tests
have passed. Briefly speaking, the bot does the following:

-   User kicks off a PR, adds an ‘automerge’ label or ‘automerge: exact’ label.
    The ‘automerge: exact’ label makes sure that further commits cannot be
    pushed to the PR while tests are waiting to pass. If further commits are
    pushed, the bot will re-request the reviewers' approval.
-   Bot listens to PR and checks to see if appropriate label was added. If so,
    and the branch has required checks, then the PR info is added to Datastore
    as an entry
-   *A cron job will run the logic below every two minutes, until it hits six
    hours. Once it hits six hours, the job will pass in a status called ‘stop’,
    which the logic will then use to determine an outcome*
    -   Merge-on-green begins by checking if there are any reviews on the bot.
        If there are any non-approved reviews, assigned reviews that have not
        been fulfilled, or if no one has reviewed the PR, the bot will fail its
        check
    -   Merge-on-green then checks to see if there is at least one commit in the
        PR
    -   Merge-on-green will look for the required checks in the statuses that
        have run. If it can’t find a given check in the statuses it will also
        check under ‘check runs’ as github has two concepts to describe status
        checks. If it cannot find them,or if anyhas failed, MOG will fail the
        Status Check
    -   Three statuses that can result:
        -   Success: Merge
        -   If all steps above come out as ‘true’, the bot will update the
            branch the PR was called from, merge the PR, and remove the
            Datastore entry so that the bot no longer tries to merge that PR
    -   Fail: Keep Checking
        -   If one of the steps fail, then the Datastore entry will remain, and
            the bot will keep checking the variables above until they become
            true or the cron job times out
    -   Fail: Delete
        -   Once the cron job times out, it will pass a ‘stop’ state to the
            logic above. If this flag is set to ‘stop’, the bot will post a
            failed check-run on the PR and ask the user to try again. The bot
            will also delete the entry from Datastore so it does not keep
            checking the logic
-   Two other cron jobs run periodically to ensure adequate registration. One
    makes sure that there are no 'hanging' PRs, i.e., that no PRs with the
    automerge label have not been added to Datastore (this can occasionally
    occur with mass-labeling of PRs). The other makes sure that there are no
    closed/merged/unlabeled PRs in Datastore, i.e., that merge-on-green does not
    keep checking PRs that have been merged/closed for another reason.

## Contributing
If you have suggestions for how merge-on-green could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the Contributing Guide.

License
Apache 2.0 © 2019 Google LLC.