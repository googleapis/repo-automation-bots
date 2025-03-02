exports['release-please bot config schema check on PRs should create a failing status check for a broken config 1'] = {
  'name': 'release-please config schema',
  'conclusion': 'failure',
  'head_sha': '19f6a66851125917fa07615dcbc0cd13dad56981',
  'output': {
    'title': 'Config schema error',
    'summary': 'An error found in the config file',
    'text': '[\n    {\n        "instancePath": "/branches",\n        "schemaPath": "#/allOf/1/properties/branches/type",\n        "keyword": "type",\n        "params": {\n            "type": "array"\n        },\n        "message": "must be array"\n    }\n]'
  }
}

exports['release-please bot config schema check on PRs should create a failing status check for broken default manifest configs 1'] = {
  'name': 'release-please-config config schema',
  'conclusion': 'failure',
  'head_sha': '19f6a66851125917fa07615dcbc0cd13dad56981',
  'output': {
    'title': 'Config schema error',
    'summary': 'An error found in the config file',
    'text': 'the given config is not valid JSON 😱 \nUnexpected token , in JSON at position 59'
  }
}

exports['release-please bot config schema check on PRs should create a failing status check for broken default manifest configs 2'] = {
  'name': '.release-please-manifest config schema',
  'conclusion': 'failure',
  'head_sha': '19f6a66851125917fa07615dcbc0cd13dad56981',
  'output': {
    'title': 'Config schema error',
    'summary': 'An error found in the config file',
    'text': '[\n    {\n        "instancePath": "/number",\n        "schemaPath": "#/additionalProperties/type",\n        "keyword": "type",\n        "params": {\n            "type": "string"\n        },\n        "message": "must be string"\n    }\n]'
  }
}

exports['release-please bot config schema check on PRs should create a failing status check for broken custom manifest configs 1'] = {
  'name': 'config config schema',
  'conclusion': 'failure',
  'head_sha': '19f6a66851125917fa07615dcbc0cd13dad56981',
  'output': {
    'title': 'Config schema error',
    'summary': 'An error found in the config file',
    'text': 'the given config is not valid JSON 😱 \nUnexpected token , in JSON at position 59'
  }
}

exports['release-please bot config schema check on PRs should create a failing status check for broken custom manifest configs 2'] = {
  'name': 'manifest config schema',
  'conclusion': 'failure',
  'head_sha': '19f6a66851125917fa07615dcbc0cd13dad56981',
  'output': {
    'title': 'Config schema error',
    'summary': 'An error found in the config file',
    'text': '[\n    {\n        "instancePath": "/number",\n        "schemaPath": "#/additionalProperties/type",\n        "keyword": "type",\n        "params": {\n            "type": "string"\n        },\n        "message": "must be string"\n    }\n]'
  }
}
