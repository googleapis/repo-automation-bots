exports['Blunderbuss issue tests assigns opened issues with no assignees 1'] = {
  "assignees": [
    "issues1"
  ]
}

exports['Blunderbuss issue tests assigns issue when correct label 1'] = {
  "assignees": [
    "issues1"
  ]
}

exports['Blunderbuss pr tests assigns user to a PR when opened with no assignee 1'] = {
  "assignees": [
    "prs1"
  ]
}

exports['Blunderbuss pr tests assigns issue when correct label 1'] = {
  "assignees": [
    "prs1"
  ]
}

exports['Blunderbuss issue tests assigns blunderbuss labeled issue by label 1'] = {
  "assignees": [
    "bar_baz_user"
  ]
}

exports['Blunderbuss issue tests assigns opened issue by label 1'] = {
  "assignees": [
    "foo_user"
  ]
}

exports['Blunderbuss issue tests assigns labeled issue by label 1'] = {
  "assignees": [
    "bar_baz_user"
  ]
}

exports['Blunderbuss pr tests assigns user to a PR when opened with no assignee, ignoring assign_issues_by 1'] = {
  "assignees": [
    "prs1"
  ]
}

exports['Blunderbuss issue tests expands teams for an issue 1'] = {
  "assignees": [
    "user123"
  ]
}

exports['Blunderbuss pr tests expands teams for a PR 1'] = {
  "assignees": [
    "user123"
  ]
}

exports['Blunderbuss pr tests assigns pr by label 1'] = {
  "assignees": [
    "java-samples-reviewers"
  ]
}

exports['Blunderbuss validateConfigChanges creates a failing status check for a broken config 1'] = {
  "name": "blunderbuss config schema",
  "conclusion": "failure",
  "head_sha": "c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a",
  "output": {
    "title": "Config schema error",
    "summary": "An error found in the config file",
    "text": "[\n    {\n        \"instancePath\": \"/assign_issues_by/0/to\",\n        \"schemaPath\": \"#/definitions/ByConfig/properties/to/type\",\n        \"keyword\": \"type\",\n        \"params\": {\n            \"type\": \"array\"\n        },\n        \"message\": \"must be array\"\n    }\n]"
  }
}
