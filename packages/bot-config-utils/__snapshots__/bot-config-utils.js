exports[
  'config test app responds to PR creates a failing status check for a wrong file name 1'
] = {
  name: 'test config schema',
  conclusion: 'failure',
  head_sha: 'ce03c1b7977aadefb5f6afc09901f106ee6ece6a',
  output: {
    title: 'Config schema error',
    summary: 'An error found in the config file',
    text: 'You tried to add .github/test.yml, but the config file must be .github/test.yaml\n',
  },
};

exports[
  'config test app responds to PR creates a failing status check for a wrong config 1'
] = {
  name: 'test config schema',
  conclusion: 'failure',
  head_sha: 'ce03c1b7977aadefb5f6afc09901f106ee6ece6a',
  output: {
    title: 'Config schema error',
    summary: 'An error found in the config file',
    text: '[\n    {\n        "instancePath": "",\n        "schemaPath": "#/additionalProperties",\n        "keyword": "additionalProperties",\n        "params": {\n            "additionalProperty": "test"\n        },\n        "message": "must NOT have additional properties"\n    }\n]',
  },
};

exports[
  'config test app with config.yml responds to PR creates a failing status check for a wrong file name 1'
] = {
  name: 'test config schema',
  conclusion: 'failure',
  head_sha: 'ce03c1b7977aadefb5f6afc09901f106ee6ece6a',
  output: {
    title: 'Config schema error',
    summary: 'An error found in the config file',
    text: 'You tried to add .github/test.yaml, but the config file must be .github/test.yml\n',
  },
};

exports[
  'config test app responds to PR creates a failing status check for broken yaml file 1'
] = {
  name: 'test config schema',
  conclusion: 'failure',
  head_sha: 'ce03c1b7977aadefb5f6afc09901f106ee6ece6a',
  output: {
    title: 'Config schema error',
    summary: 'An error found in the config file',
    text: 'the given config is not valid YAML 😱 \nunexpected end of the stream within a flow collection (2:1)\n\n 1 | test: [[\n 2 | \n-----^',
  },
};

exports[
  'config test app with multiple schema files responds to PR creates a failing status check for a wrong config 1'
] = {
  name: 'test config schema',
  conclusion: 'failure',
  head_sha: 'ce03c1b7977aadefb5f6afc09901f106ee6ece6a',
  output: {
    title: 'Config schema error',
    summary: 'An error found in the config file',
    text: '[\n    {\n        "instancePath": "",\n        "schemaPath": "#/type",\n        "keyword": "type",\n        "params": {\n            "type": "array"\n        },\n        "message": "must be array"\n    }\n]',
  },
};
