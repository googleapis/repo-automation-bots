# Blunderbuss

> A GitHub App built with [Probot](https://github.com/probot/probot) that assigns issues and prs 
randomly to a specific list of users

## Usage

Blunderbuss randomly assigns from a set of users specified in the config file located at 
`.config/blunderbuss.yml` for each repo. Both fields are currently optional. 

```yaml
assign_issues:
  - issue_assignee1
  - issue_assignee2
assign_prs:
  - pr_assignee1
  - pr_assignee2
```

Blunderbuss can also be manually triggered by attached a "blunderbuss: assign" label to either and 
issue or PR.

Blunderbuss will not assign issues or PRs to the user who opened them, and will ignore an issue
if no valid assignees are found. 

For opened/reopened issues or prs, Blunderbuss will not assign a user if the issue already has an
assignee.

## Setup

```sh
# Install dependencies
npm install

# Run the bot
npm start
```

## Testing

This bot uses [nock](https://www.npmjs.com/package/nock) for mocking requests
to GitHub, and [snap-shot-it](https://www.npmjs.com/package/snap-shot-it) for capturing
responses; This allows updates to the API surface to be treated as a visual diff,
rather than tediously asserting against each field.

Running tests:

```sh
npm run test
```

To update snapshots:

```sh
npm run test:snap
```

## Contributing

If you have suggestions for how conventional-commit-lint could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](CONTRIBUTING.md).

## License

Apache 2.0 © 2019 Google Inc.

