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

Here is a simple example with cron:
```typescript
import {syncLabels} from '@google-automations/label-utils';
const myLabels = [
  {
    name: 'my-bot:my-label',
    description: 'label description'
  },
];

  app.on('schedule.repository' as '*', async context => {
    const owner = context.payload.organization.login;
    const repo = context.payload.repository.name;
    await syncLabels(context.octokit, owner, repo, myLabels);
  });

```

The cron.yaml:
```yaml
cron:
  - name: my-bot-sync-label
    schedule: 0 3 * * *
    description: my-bot syncing labels
    params:
      cron_type: "repository"
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
