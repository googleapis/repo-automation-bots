exports['slo-status-label handleSLOs triggered Error is logged if comment on PR fails 1'] = {
  "body": "ERROR: \"issue_slo_rules.json\" file is not valid with Json schema"
}

exports['slo-status-label handleSLOs triggered Error is logged if create check fails 1'] = {
  "body": "ERROR: \"issue_slo_rules.json\" file is not valid with Json schema"
}

exports['slo-status-label handleSLOs triggered Error is logged if create check fails 2'] = {
  "name": "slo-rules-check",
  "conclusion": "failure",
  "head_sha": "c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a",
  "output": {
    "title": "Invalid slo rules detected",
    "summary": "issue_slo_rules.json does not follow the slo_rules schema.",
    "text": "[\n    {\n        \"keyword\": \"required\",\n        \"dataPath\": \"[0].complianceSettings\",\n        \"schemaPath\": \"#/definitions/complianceSettings/required\",\n        \"params\": {\n            \"missingProperty\": \"resolutionTime\"\n        },\n        \"message\": \"should have required property 'resolutionTime'\"\n    }\n]"
  }
}

exports['slo-status-label handleSLOs triggered An error comment is made on PR and failure check if issue_slo_rules lint is not valid 1'] = {
  "body": "ERROR: \"issue_slo_rules.json\" file is not valid with Json schema"
}

exports['slo-status-label handleSLOs triggered An error comment is made on PR and failure check if issue_slo_rules lint is not valid 2'] = {
  "name": "slo-rules-check",
  "conclusion": "failure",
  "head_sha": "c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a",
  "output": {
    "title": "Invalid slo rules detected",
    "summary": "issue_slo_rules.json does not follow the slo_rules schema.",
    "text": "[\n    {\n        \"keyword\": \"required\",\n        \"dataPath\": \"[0].complianceSettings\",\n        \"schemaPath\": \"#/definitions/complianceSettings/required\",\n        \"params\": {\n            \"missingProperty\": \"resolutionTime\"\n        },\n        \"message\": \"should have required property 'resolutionTime'\"\n    }\n]"
  }
}

exports['slo-status-label handleSLOs triggered No comment on PR and success check if issue_slo_rules lint is valid 1'] = {
  "name": "slo-rules-check",
  "conclusion": "success",
  "head_sha": "c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a"
}
