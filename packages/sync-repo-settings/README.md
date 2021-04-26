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

# Automatically delete head branches after merging PRs.  Defaults to `true`.
deleteBranchOnMerge: true

# Rules for branch protection (add multiple entries to configure multiple branches)
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

## Using the CLI

This library also provides a command line binary: `sync-repo-settings`. It can be used
to simulate the bot's behavior (pull the configuration from the remote repository) or
using a local file.

To authenticate, set the `GITHUB_TOKEN` environment variable to a personal access token
that has admin access on the repository.

### Remote configuration

To use with a repostory's installed configuration at `.github/sync-repo-settings.yaml`:

```bash
sync-repo-settings --repo=<owner/repo to update> [--branch=<optional branch name>]
```

### Local configuration

To use with a local file:

```bash
sync-repo-settings --repo=<owner/repo to update> --file=path/to/config.yaml [--branch=<optional branch name>]
```

### Full Options

| Option | Description | Default |
| ------ | ----------- | ------- |
| repo | Repository slug (owner/repo) | *Required* |
| branch | Name of the branch to fetch remote configuration from | (default repository branch) |
| file | Path to local configuration file | |
| github-token | Personal access token. Can alternatively be set via the `GITHUB_TOKEN` environment variable | *Required* |
