# object-selector

This is a small library for selecting objects. The main user of this
library are the bot authors who want to choose objects based on their
propery values and make it configurable in the bot config files.

1. Bot author define the config file.

  "I want the bot user or org admins can configure some conditions for
   the target objects."

2. Bot user or org admins create the config file with some selector
   definitions.

   "I want the bot to skip private repositories"
   ["private", "eq", "false"]

3. The bot can choose the intended objects.

   "Ok, I skip private repositories"

## Background
Here is an example attempt to implement something similar:
https://github.com/googleapis/.github/pull/9/files

The first user of this library will be the sync-repo-settings bot for
implementing its org level config(#1884).

## Install

```bash
npm i @google-automations/object-selector
```

## Concepts

This library allows bot authors to have rules for selecting objects in
its config file. The smallest config element is called `selector`.
```typescript
type SelectorValueType = string | number | boolean | Array<string>;

export type Operator = 'eq' | 'ne' | 'anyof' | 'regex';

export type Selector = [string, Operator, SelectorValueType];
```

In the yaml config file, it looks like:
```yaml
["name", "regex", "(nodejs|javascript|typescript)"]
```
or
```yaml
["private", "eq", false]
```

Then we call a list of selectors `Selectors`.
```typescript
export type Selectors = Array<Selector>;
```

In the yaml config:
```yaml
- ["private", "eq", false]
- ["archived", "eq", false]
- ["org", "anyof", ["GoogleCloudPlatform", "googleapis"]]
- ["name", "regex", "(nodejs|javascript|typescript)"]
```

A single `Selectors` represents a condition where all the selectors
are combined with `AND`.

## Usage

It is strongly recommended to use the provided schema file for schema
validation of your config file. The schema is defined in
`selectors-schema.json` file and you can refer the definition of
`Selectors` as `@google-automations/selectors/v1` and `Selector` as
`@google-automations/selector/v1`.

You will likely have to provide the schema file to the validator:

```typescript
import schema from './my-schema.json';
import selectorsSchema
  from '@google-automations/object-selector/build/src/selectors-schema.json';

const checker = new ConfigChecker<Config>(
  schema, CONFIG_FILE_NAME, [selectorsSchema]
);

```

Then you can refer the definition from your schema.
```json
{ "$ref": "@google-automations/selectors/v1" }
{ "$ref": "@google-automations/selector/v1" }
```

You can also import the types from this library.
```typescript
import {
  SelectorValueType,
  Selector,
  Selectors
} from '@google-automations/object-selector';

```

### Select the object

Let's say you want to filter the Github repositories. The code example
for selecting archived repositories goes like this:
```typescript
import {Endpoints} from '@octokit/types';

import {
  Selectors,
  ObjectSelector,
  RepoDescriptorConvertor
} from '@google-automations/object-selector';

export type Repository =
  Endpoints['GET /repos/{owner}/{repo}']['response']['data'];

const selectors:Selectors = [["archived", "eq", true]];

const repos = await(getRepos()); // Somehow you got all the repos.

// It accepts a list of `Selectors`(list of list of selectors).
// Each `Selectors` are combined by `OR`.
const selector = new ObjectSelector<Repository>(
  [selectors], RepoDescriptorConvertor
)
const selected = selector.select(repos);
// Now `selected` contains archived repos.
// or you can call `match` with an individual object for boolean result.
for (const repo of repos) {
  if (selector.match(repo)) {
    // do something
  }
}
```

### CLI and recipes for repositories

The library provides cli, which is a small demo application for
selecting repositories. You can install the cli by:
```bash
$ cd packages/object-selector
$ npm link .
```

You can try filtering some repositories, for example, you can list
nodejs repositories form a small data file by:
```bash
$ object-selector test-yaml -f test/fixtures/repos.json -y recipes/nodejs.yaml
```

It will accept multiple recipe files in `recipes` directory:
```bash
$ object-selector test-yaml -f test/fixtures/repos.json -y recipes/*.yaml
```

If the data file `test/fixtures/repos.json` is not enough for you, you
can dump all the repos with `dump` command. For dumping the real data,
you have to set GITHUB_TOKEN environment variable:
```bash
$ export GITHUB_TOKEN=$(cat your-github-token-file)
$ object-selector dump
```

This will create `repositories-dump.json` for bigger dataset. The
`test-yaml` command will use this file by default.
```bash
$ object-selector test-yaml -y recipes/*.yaml
```
