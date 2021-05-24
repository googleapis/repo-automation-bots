exports['generated-files-bot handler opened pull request ignores missing manifests 1'] = {
  "body": "<!-- probot comment [1219791]-->\n*Warning*: This pull request is touching the following templated files:\n\n* file1.txt"
}

exports['generated-files-bot handler opened pull request comments on pull request that touches templated files 1'] = {
  "body": "<!-- probot comment [1219791]-->\n*Warning*: This pull request is touching the following templated files:\n\n* file1.txt\n* test.html\n* docs/README.md - docs are auto-generated\n* src/.data/test.json\n* value1"
}

exports['generated-files-bot handler opened pull request updates existing comment 1'] = {
  "body": "<!-- probot comment [1219791]-->\n*Warning*: This pull request is touching the following templated files:\n\n* file1.txt\n* value1"
}

exports['validateConfigChanges compatibility tests creates a failing status check for broken config 1'] = {
  "name": "generated-files-bot config schema",
  "conclusion": "failure",
  "head_sha": "c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a",
  "output": {
    "title": "Config schema error",
    "summary": "An error found in the config file",
    "text": "[\n    {\n        \"instancePath\": \"/externalManifests/0\",\n        \"schemaPath\": \"#/definitions/ExternalManifest/required\",\n        \"keyword\": \"required\",\n        \"params\": {\n            \"missingProperty\": \"jsonpath\"\n        },\n        \"message\": \"must have required property 'jsonpath'\"\n    }\n]"
  }
}
