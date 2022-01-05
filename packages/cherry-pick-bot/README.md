# cherry-pick-bot

This bot assists in maintain changes across branches in a repository
by easily cherry-picking changes via pull requests.

## Usage

If you are an owner or collaborator of the repository or you are a member of
the repository's organization, you can add a comment to a merged pull request:

```
/cherry-pick target-branch-name
```

`target-branch-name` is the branch to cherry-pick to. `cherry-pick-bot` will
cherry-pick the merged commit to a new branch (created from the target branch)
and open a new pull request.

## Configuring

To enable the bot, create a configuration file at `.github/cherry-pick-bot.yml`.

Available configuration options:

| Name | Description | Default |
| ---- | ----------- | ------- |
| `enabled` | Whether this bot is enabled or not | `true` |

## Running tests:

`npm test`

## Contributing

If you have suggestions for how cherry-pick-bot could be improved, or want to
report a bug, open an issue! We'd love all and any contributions.

For more, check out the Contributing Guide.

License
Apache 2.0 © 2022 Google LLC.