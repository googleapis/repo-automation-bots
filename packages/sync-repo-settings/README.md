# Sync Repo Settings
> This bot takes settings in a `.github/sync-repo-settings.yaml` file, and automatically applies them to your repository.

## Using the bot
To use the bot, start by [enabling it on your repository](https://github.com/apps/sync-repo-settings).  It is on automatically for the `googleapis` org.

Next, create a file in `.github/sync-repo-settings.yaml` in your repository.  The complete options supported include:

```yaml
# Whether or not rebase-merging is enabled on this repository.
# Defaults to `true`
rebaseMergeAllowed: true

# Whether or not squash-merging is enabled on this repository.
# Defaults to `true`
squashMergeAllowed: true

# Whether or not PRs are merged with a merge commit on this repository.
# Defaults to `false`
mergeCommitAllowed: false

# Rules for master branch protection
branchProtectionRules:
# Identifies the protection rule pattern. Name of the branch to be protected.
# Defaults to `master`
- pattern: master
  # Can admins overwrite branch protection.
  # Defaults to `true`
  isAdminEnforced: true
  # Number of approving reviews required to update matching branches.
  # Defaults to `1`
  requiredApprovingReviewCount: 1
  # Are reviews from code owners required to update matching branches.
  # Defaults to `false`
  requiresCodeOwnerReviews: true
  # Require up to date branches
  requiresStrictStatusChecks: true
  # Automatically delete head branches after merging PRs.  Defaults to `true`.
  deleteBranchOnMerge: true
  # List of required status check contexts that must pass for commits to be accepted to matching branches.
  requiredStatusCheckContexts:
    - check1
    - check2
# List of explicit permissions to add (additive only)
permissionRules:
    # Team slug to add to repository permissions
  - team: team1
    # Access level required, one of push|pull|admin
    permission: push
```

Settings will be immediately applied after committing the config to the default branch.
The bot is currently configured to run on a cron job, and updates settings 1am PST.
