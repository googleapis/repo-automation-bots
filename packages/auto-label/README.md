# auto-label

The auto-label bot automatically label issues and pull requests.

There are 3 types of labels available:
1. Product labels (enabled by default): Product-specific repos are always labeled with the API label
for that product. The product can also be auto-detected from the issue/PR title.

2. Language labels (enabled by configuration - [see below](#language-label)): PRs are labeled with a relevant language based on code changes. Language categorization and labeling by directory paths can be customized.

2. Path labels (enabled by configuration - [see below](#path-label)): PRs are labeled according to directory structure. Customizable.

Auto-label is different from label-sync, auto-label adds labels to your issues, whereas label-sync cleans up labels in your repository.

## Product Label
Bot runs every night, when repositories are created, and when issues are created. So, wait until the next day if you just added the bot to see your issues backlabeled.

Product labeling is turned on by default. To turn off product labeling:
```yaml
# In .github/auto-label.yaml
product: false
```

The following formats are known to work:

Issue title | Label
----------- | -----
`spanner: ignored` | `api: spanner`
`spanner/ignored` | `api: spanner`
`spanner.ignored` | `api: spanner`
`SPANNER.IGNORED` | `api: spanner`
`spanner_ignored` | `api: spanner`
`SPAN ner: ignored` | `api: spanner`
`ignored(spanner): ignored` | `api: spanner`
`ignored(spanner/ignored): ignored` | `api: spanner`
`ignored(/spanner/ignored): ignored` | `api: spanner`
`iot: ignored` | `api: cloudiot`

Certain prefixes of the above formats are also supported:

Issue title | Label
----------- | -----
`com.example.spanner: ignored` | `api: spanner`
`com.google.spanner.ignored: ignored` | `api: spanner`
`fix(snippets.spanner.ignored): ignored` | `api: spanner`

-------------------

## Language Label

Bot runs on new pull requests. You can find a list of default file extension to [language mappings here](https://github.com/googleapis/repo-automation-bots/blob/main/packages/auto-label/src/extensions.json).

Language labeling is turned off by default. To turn on language labeling:
```yaml
# In .github/auto-label.yaml
language:
  pullrequest: true
```

You can customize labeling logic to:
- Re-map file extensions to language names, e.g. label `.ts` files as "lang: js"
- Define languages at a path level which is helpful for monorepos, e.g. label all files in `/src/` directory as "python"
- Change your label prefix, e.g. add a "language:_" prefix to all language labels

Simple configuration example:
```yaml
# In .github/auto-label.yaml
language:
  pullrequest: true
  labelprefix: 'lang:'
  extensions:
    js: ['JSON', 'ts']
    # i.e. label all JSON and ts files as "lang:js"
  paths:
    .: 'js'
    # i.e., label all files in root directory as "lang:js"
    test:
      .: 'python'
      # i.e. label all files in ./test/ directory as "lang:python"
      fixtures: 'markdown'
      # i.e. label all files in ./test/fixtures as "lang:markdown"
      # Note: labels will respect the deepest path configuration
```

-------------------

## Path Label

Bot runs on new pull requests.

Path labeling is turned off by default. To turn on path labeling:
```yaml
# In .github/auto-label.yaml
path:
  pullrequest: true
```

To prefix labels with a string:
```yaml
# In .github/auto-label.yaml
path:
  pullrequest: true
  labelprefix: 'dir: '
```

To define how certain directories should be labeled (Note: labels will respect the deepest path configuration):
```yaml
# In .github/auto-label.yaml
path:
  pullrequest: true
  paths:
    .: 'root'
    # i.e., label all PRs of files in root directory and down as "root"
    test:
      .: 'test'
      # i.e. label all files in ./test/ directory and down as "test"
      fixtures: 'testfixtures'
      # i.e. label all files in ./test/fixtures and down as "testfixtures"
```

-------------------

## Staleness Label

Bot runs on all pull requests and labels them with staleness indicator based on configured values. Currently there are two staleness labels available: `stale: old` and `stale: extraold`.

Staleness labeling is turned off by default. To turn on staleness labeling:

```yaml
# In .github/auto-label.yaml
staleness:
  pullrequest: true
  old: 10
  # By default old is 60 days if no value is configured
  extraold: 20
  # By default extraold is 120 days if no value is configured
```

-------------------

## Size Label

Bot runs on a pull request when it changes and labels them with T-shirt size indicator if feature is enabled. 

Currently there are following labels available:

  `size: xs` for pull request with less than 50 changes.
  
  `size: s` for pull request with less than 250 changes.
  
  `size: m` for pull request with less than 1000 changes.
  
  `size: l` for pull request with less than 1250 changes.
  
  `size: xl` for pull request with less than 1500 changes.
  
  `size: xxl` for pull request with more than 1500 changes.
  

Size labeling is turned off by default. To turn on size labeling:

```yaml
# In .github/auto-label.yaml
requestsize:
  enabled: true
```

## Running tests:

Instructions are provided in [googleapis/repo-automation-bots](https://github.com/googleapis/repo-automation-bots/blob/main/README.md) for deploying and testing your bots.

This bot uses nock for mocking requests to GitHub, and snap-shot-it for capturing responses; This allows updates to the API surface to be treated as a visual diff, rather than tediously asserting against each field.

`npm run test`

## To update snapshots:

`npm run test:snap`

## Contributing

If you have suggestions for how auto-label could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the Contributing Guide.

License
Apache 2.0 © 2019 Google LLC.
