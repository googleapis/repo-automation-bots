# generated-files-bot

The template bot automatically comments on pull requests if you are modifying templated files.

To identify a templated file, you must provide configuration in the `.github/generated-files-bot.yml` file in your repository.

## Setup

```sh
# Install dependencies
npm install

# Run the bot
npm start
```

### Configuration

To configure the bot, you can create a configuration file:
`.github/generated-files-bot.yml`. The contents of this file allow for the following
options:

| Name | Description | Type | Default |
| ---- | ----------- | ---- | ------- |
| `generatedFiles`    | An explicit list of files which are considered templates. | `string[]` | `[]` |
| `externalManifests` | List of external manifest files to parse. | `ExternalManifest[]` | `[]` |

External Manifest:

| Name | Description | Type |
| ---- | ----------- | ---- |
| `type` | Manifest file format | `"json"` or `"yaml"` |
| `file` | Path to the manifest in the repository | `string` |
| `jsonpath` | [JsonPath query](https://goessner.net/articles/JsonPath/) to find the list of template files | `string` |

## Testing

## Running tests:

`npm run test`

## To update snapshots:

`npm run test:snap`

## Contributing

If you have suggestions for how generated-files-bot could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the Contributing Guide.

License
Apache 2.0 © 2020 Google LLC.