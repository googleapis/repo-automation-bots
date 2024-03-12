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

exports[
  'cherry-pick-bot config validation submits a failing check with an invalid enum 1'
] = {
  name: 'cherry-pick-bot config schema',
  conclusion: 'failure',
  head_sha: 'ec26c3e57ca3a959ca5aad62de7213c562f8c821',
  output: {
    title: 'Config schema error',
    summary: 'An error found in the config file',
    text: '[\n    {\n        "instancePath": "/allowedAuthorAssociations/0",\n        "schemaPath": "#/properties/allowedAuthorAssociations/items/enum",\n        "keyword": "enum",\n        "params": {\n            "allowedValues": [\n                "COLLABORATOR",\n                "CONTRIBUTOR",\n                "FIRST_TIMER",\n                "FIRST_TIME_CONTRIBUTOR",\n                "MANNEQUIN",\n                "MEMBER",\n                "NONE",\n                "OWNER"\n            ]\n        },\n        "message": "must be equal to one of the allowed values"\n    }\n]',
  },
};
