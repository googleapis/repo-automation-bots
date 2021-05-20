# Utility for syncing bot labels

This is a small utility for syncing bot specific labels.

## Usage

### Install

```bash
npm i @google-automations/label-utils
```

### Usage

`syncLabels` will automatically create or update the labels.  The
color is determined by its name and should be consistent among
repositories.

Here is a simple example:
```typescript
import {syncLabels} from '@google-automations/label-utils';
const myLabels = [
  {
    name: 'my-bot:my-label',
    description: 'label description'
  },
];
await syncLabels(context.octokit, owner, repo, myLabels);
```

Here is another example for syncing the label in
`installation_repositories.added` event:

```typescript
interface Repo {
  full_name: string;
}

const myLabels = [
  {
    name: 'my-bot:my-label',
    description: 'label description'
  },
];

export = (app: Probot) => {
  app.on('installation_repositories.added', async context => {
    await Promise.all(
      context.payload.repositories_added.map((r: Repo) => {
        const [owner, repo] = r.full_name.split('/');
        return syncLabels(
          context.octokit,
          owner,
          repo,
          myLabels
        );
      })
    );
  });
}
```
