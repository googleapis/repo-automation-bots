exports['slo-lint handleSLOs is triggered Error is logged if commenting on PR fails and calls handle issues 1'] = {
  "body": "ERROR: \"issue_slo_rules.json\" file is not valid with JSON schema"
}

exports['slo-lint handleSLOs is triggered Error is logged if commenting on PR fails and calls handle issues 2'] = {
  "name": "slo-rules-check",
  "head_sha": "c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a",
  "conclusion": "failure",
  "output": {
    "title": "Commit message did not follow Conventional Commits",
    "summary": "issue_slo_rules.json does not follow the slo_rules schema.",
    "text": "[\n    {\n        \"instancePath\": \"/0/complianceSettings\",\n        \"schemaPath\": \"#/definitions/complianceSettings/required\",\n        \"keyword\": \"required\",\n        \"params\": {\n            \"missingProperty\": \"resolutionTime\"\n        },\n        \"message\": \"must have required property 'resolutionTime'\"\n    }\n]"
  }
}

exports['slo-lint handleSLOs is triggered Error is logged if creating check on PR fails and calls handle issues 1'] = {
  "body": "ERROR: \"issue_slo_rules.json\" file is not valid with JSON schema"
}

exports['slo-lint handleSLOs is triggered Error is logged if creating check on PR fails and calls handle issues 2'] = {
  "name": "slo-rules-check",
  "head_sha": "c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a",
  "conclusion": "failure",
  "output": {
    "title": "Commit message did not follow Conventional Commits",
    "summary": "issue_slo_rules.json does not follow the slo_rules schema.",
    "text": "[\n    {\n        \"instancePath\": \"/0/complianceSettings\",\n        \"schemaPath\": \"#/definitions/complianceSettings/required\",\n        \"keyword\": \"required\",\n        \"params\": {\n            \"missingProperty\": \"resolutionTime\"\n        },\n        \"message\": \"must have required property 'resolutionTime'\"\n    }\n]"
  }
}

exports['slo-lint handleSLOs is triggered An error comment and failure check is made on PR if issue_slo_rules lint is not valid 1'] = {
  "body": "ERROR: \"issue_slo_rules.json\" file is not valid with JSON schema"
}

exports['slo-lint handleSLOs is triggered An error comment and failure check is made on PR if issue_slo_rules lint is not valid 2'] = {
  "name": "slo-rules-check",
  "head_sha": "c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a",
  "conclusion": "failure",
  "output": {
    "title": "Commit message did not follow Conventional Commits",
    "summary": "issue_slo_rules.json does not follow the slo_rules schema.",
    "text": "[\n    {\n        \"instancePath\": \"/0/complianceSettings\",\n        \"schemaPath\": \"#/definitions/complianceSettings/required\",\n        \"keyword\": \"required\",\n        \"params\": {\n            \"missingProperty\": \"resolutionTime\"\n        },\n        \"message\": \"must have required property 'resolutionTime'\"\n    }\n]"
  }
}

exports['slo-lint handleSLOs is triggered Leaves no comment on PR and sets success check if issue_slo_rules lint is valid 1'] = {
  "name": "slo-rules-check",
  "head_sha": "c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a",
  "conclusion": "success"
}
