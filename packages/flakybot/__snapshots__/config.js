exports['config test app responds to PR creates a failing status check for a wrong config 1'] = {
  "name": "test config schema",
  "conclusion": "failure",
  "head_sha": "ce03c1b7977aadefb5f6afc09901f106ee6ece6a",
  "output": {
    "title": "Config schema error",
    "summary": "An error found in the config file",
    "text": "[\n    {\n        \"instancePath\": \"\",\n        \"schemaPath\": \"#/additionalProperties\",\n        \"keyword\": \"additionalProperties\",\n        \"params\": {\n            \"additionalProperty\": \"wrongConfig\"\n        },\n        \"message\": \"must NOT have additional properties\"\n    }\n]"
  }
}

exports['config test app responds to PR creates a failing status check for a wrong file name 1'] = {
  "name": "test config schema",
  "conclusion": "failure",
  "head_sha": "ce03c1b7977aadefb5f6afc09901f106ee6ece6a",
  "output": {
    "title": "Config schema error",
    "summary": "An error found in the config file",
    "text": "You tried to add .github/test.yml, but the config file must be .github/test.yaml\n"
  }
}
