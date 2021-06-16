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
