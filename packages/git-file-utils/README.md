# git-file-utils

This is a small library for handling git files. Currently it only provides
`RepositoryFileCache` which is a read-through cache for a single branch. Because
this library uses GIt Data API, it can fetch files up to 100 MB of size.

## Install

```bash
npm i @google-automations/git-file-utils
```

## Fetch a file

```typescript
import {Octokit} from '@octokit/rest';
import {
  FileNotFoundError,
  RepositoryFileCache
} from '@google-automations/git-file-utils';

const octokit = new Octokit();
const cache = new RepositoryFileCache(
  octokit,
  {
    owner: "googleapis",
    repo: "repo-automation-bots",
  });
try {
  const contents = await cache.getFileContents("README.md", "main");
  console.log(`content: ${contents.parsedContent}`);
} catch (e) {
  if (e instanceof FileNotFoundError) {
    console.log(`file not found`);
  } else {
    // rethrow
    throw e;
  }
}
```
