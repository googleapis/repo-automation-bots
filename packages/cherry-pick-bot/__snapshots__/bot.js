exports[
  'cherry-pick-bot config validation submits a failing check with a broken config file 1'
] = {
  name: 'cherry-pick-bot config schema',
  conclusion: 'failure',
  head_sha: 'ec26c3e57ca3a959ca5aad62de7213c562f8c821',
  output: {
    title: 'Config schema error',
    summary: 'An error found in the config file',
    text: '[\n    {\n        "instancePath": "/preservePullRequestTitle",\n        "schemaPath": "#/properties/preservePullRequestTitle/type",\n        "keyword": "type",\n        "params": {\n            "type": "boolean"\n        },\n        "message": "must be boolean"\n    }\n]',
  },
};
