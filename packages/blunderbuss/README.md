# Blunderbuss

> A GitHub App built with [Probot](https://github.com/probot/probot) that assigns issues and prs
randomly to a specific list of users

## Usage

Blunderbuss randomly assigns from a set of users specified in the config file located at
`.github/blunderbuss.yml` for each repo. All fields are currently optional.

```yaml
assign_issues:
  - issue_assignee_1
  - issue_assignee_2
assign_issues_by:
  - labels:
    - 'api: one'
    - 'api: two'
    to:
    - label_assignee_1
    - label_assignee_2
  - labels:
    - 'api: three'
    to:
    - label_assignee_3
assign_prs:
  - pr_assignee_1
  - pr_assignee_2
```

Blunderbuss can also be manually triggered by attaching a "blunderbuss: assign" label to either an
issue or PR.

The `assign_issues_by` option allows you to assign issues based on the issue's
labels.
`assign_issues_by` has a higher precedence than `assign_issues`.

* If you add the "blunderbuss: assign" label, the issue will be assigned based
  on any label on the issue. If no label matches, Blunderbuss will fall back to
  the other entries in `assign_issues`, if any.
* If you add a different label to an issue, Blunderbuss will only assign the
  issue if the new label is configured in `assign_issues_by`. If the new label
  is configured, the issue will be assigned based on any label on the issue.
  This avoids Blunderbuss assigning old issues when they have an unrelated label
  added.
  * If an issue is already assigned, Blunderbuss will not change the assignee if
    you add a configured label.

Blunderbuss will not assign issues or PRs to the user who opened them, and will ignore an issue
if no valid assignees are found.

For opened/reopened issues or PRs, Blunderbuss will not assign a user if the issue already has an
assignee.

Pull Requests will not be assigned a user while in draft mode.

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

If you have suggestions for how blunderbuss could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the [Contributing Guide](../../CONTRIBUTING.md).

## License

Apache 2.0 © 2019 Google Inc.

