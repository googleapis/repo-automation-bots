# A distributed lock

This is a simple lock library backed by Google Cloud Datastore.

Github bots can have multiple instances and sometimes those instances
are modifying the same target (issue, pull request, etc). This simple
library allows the bot to acquire a lock on sth.

## Usage

### Install

```bash
npm i @google-automations/datastore-lock
```

### Usage

```typescript
import {DatastoreLock} from '@google-automations/datastore-lock';

// Most of the cases, you can just pass `lockId` and `target`.
// `lockId` is usually the bot name.
// `target` is the target for the lock.

const lockId = 'blunderbuss';
const target = context.payload.pull_request.url;

const lock = new DatastoreLock(lockId, target);
const result = await lock.acquire();
if (!result) {
	// failure
}
// Do your stuff, and release the lock after you've done.
result = await lock.release();
// The lock will become stale after 20 seconds.
// You can pass the 3rd argument for longer expiry, up to 60 seconds.
const lock2 = new DatastoreLock(lockId, target, 60 * 1000);
```
