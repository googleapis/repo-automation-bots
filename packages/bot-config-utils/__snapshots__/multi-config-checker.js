exports[
  'MultiConfigChecker with config changes validates a single JSON config 1'
] = {
  name: 'foo config schema',
  conclusion: 'failure',
  head_sha: 'def234',
  output: {
    title: 'Config schema error',
    summary: 'An error found in the config file',
    text: '[\n    {\n        "instancePath": "",\n        "schemaPath": "#/additionalProperties",\n        "keyword": "additionalProperties",\n        "params": {\n            "additionalProperty": "test"\n        },\n        "message": "must NOT have additional properties"\n    }\n]',
  },
};

exports[
  'MultiConfigChecker with config changes validates a single YAML config 1'
] = {
  name: 'bar config schema',
  conclusion: 'failure',
  head_sha: 'def234',
  output: {
    title: 'Config schema error',
    summary: 'An error found in the config file',
    text: '[\n    {\n        "instancePath": "",\n        "schemaPath": "#/additionalProperties",\n        "keyword": "additionalProperties",\n        "params": {\n            "additionalProperty": "test"\n        },\n        "message": "must NOT have additional properties"\n    }\n]',
  },
};

exports['MultiConfigChecker with config changes validates multiple configs 1'] =
  {
    name: 'foo config schema',
    conclusion: 'failure',
    head_sha: 'def234',
    output: {
      title: 'Config schema error',
      summary: 'An error found in the config file',
      text: '[\n    {\n        "instancePath": "",\n        "schemaPath": "#/additionalProperties",\n        "keyword": "additionalProperties",\n        "params": {\n            "additionalProperty": "test"\n        },\n        "message": "must NOT have additional properties"\n    }\n]',
    },
  };

exports['MultiConfigChecker with config changes validates multiple configs 2'] =
  {
    name: 'bar config schema',
    conclusion: 'failure',
    head_sha: 'def234',
    output: {
      title: 'Config schema error',
      summary: 'An error found in the config file',
      text: '[\n    {\n        "instancePath": "",\n        "schemaPath": "#/additionalProperties",\n        "keyword": "additionalProperties",\n        "params": {\n            "additionalProperty": "test"\n        },\n        "message": "must NOT have additional properties"\n    }\n]',
    },
  };
