exports['trusted-contribution bot config schema check on PRs should create a failing status check for a broken config 1'] = {
  'name': 'trusted-contribution config schema',
  'conclusion': 'failure',
  'head_sha': '87139750cdcf551e8fe8d90c129527a4f358321c',
  'output': {
    'title': 'Config schema error',
    'summary': 'An error found in the config file',
    'text': '[\n    {\n        "instancePath": "/annotations",\n        "schemaPath": "#/properties/annotations/type",\n        "keyword": "type",\n        "params": {\n            "type": "array"\n        },\n        "message": "must be array"\n    }\n]'
  }
}
