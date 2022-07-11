# Utility for Managing GitHub issues

This is a small utility for managing GitHub issues.

## Usage

### Install

```bash
npm i @google-automations/issue-utils
```

### Usage

`addOrUpdateIssue` will automatically open or update a GitHub issue.
It searches for the issue by title and will update it if necessary.

Example usage:

```ts
import {addOrUpdateIssue} from '@google-automations/issue-utils';

const issue = await addOrUpdateIssue(
  octokit,
  'testOwner',
  'testRepo',
  'This is the title of the issue',
  'This is the body of the issue',
  ['some-label', 'another-label']
);
console.log('Issue: ', issue.number);
```
