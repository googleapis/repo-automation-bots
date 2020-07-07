// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
exports[
  'slo-status-label Checking for compliant settings given a slo applies to an issue repo level file exists with write contributer being valid responder Returns false if no valid responder commented 1'
] = {
  labels: ['OOSLO'],
};

exports[
  'slo-status-label Checking for compliant settings given a slo applies to an issue org level file exists with admin contributer being valid responder Returns false if issue does not have comment from valid responder 1'
] = {
  labels: ['OOSLO'],
};

exports[
  'slo-status-label Checking for compliant settings given a slo applies to an issue org level file exists with admin contributer being valid responder Returns false if issue does not have assignee from valid responder 1'
] = {
  name: 'OOSLO',
  color: 'ff6f6f',
  description: 'Issue is out of slo',
};

exports[
  'slo-status-label Checking for compliant settings given a slo applies to an issue org level file exists with admin contributer being valid responder Returns false if issue does not have assignee from valid responder 2'
] = {
  labels: ['OOSLO'],
};

exports[
  'slo-status-label handleSLOs triggered Error is logged if comment on PR fails 1'
] = {
  body: 'ERROR: "issue_slo_rules.json" file is not valid with JSON schema',
};

exports[
  'slo-status-label handleSLOs triggered Error is logged if create check fails 1'
] = {
  body: 'ERROR: "issue_slo_rules.json" file is not valid with JSON schema',
};

exports[
  'slo-status-label handleSLOs triggered Error is logged if create check fails 2'
] = {
  name: 'slo-rules-check',
  head_sha: 'c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a',
  conclusion: 'failure',
  output: {
    title: 'Commit message did not follow Conventional Commits',
    summary: 'issue_slo_rules.json does not follow the slo_rules schema.',
    text:
      '[\n    {\n        "keyword": "required",\n        "dataPath": "[0].complianceSettings",\n        "schemaPath": "#/definitions/complianceSettings/required",\n        "params": {\n            "missingProperty": "resolutionTime"\n        },\n        "message": "should have required property \'resolutionTime\'"\n    }\n]',
  },
};

exports[
  'slo-status-label handleSLOs triggered An error comment is made on PR and failure check if issue_slo_rules lint is not valid 1'
] = {
  body: 'ERROR: "issue_slo_rules.json" file is not valid with JSON schema',
};

exports[
  'slo-status-label handleSLOs triggered An error comment is made on PR and failure check if issue_slo_rules lint is not valid 2'
] = {
  name: 'slo-rules-check',
  head_sha: 'c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a',
  conclusion: 'failure',
  output: {
    title: 'Commit message did not follow Conventional Commits',
    summary: 'issue_slo_rules.json does not follow the slo_rules schema.',
    text:
      '[\n    {\n        "keyword": "required",\n        "dataPath": "[0].complianceSettings",\n        "schemaPath": "#/definitions/complianceSettings/required",\n        "params": {\n            "missingProperty": "resolutionTime"\n        },\n        "message": "should have required property \'resolutionTime\'"\n    }\n]',
  },
};

exports[
  'slo-status-label handleSLOs triggered No comment on PR and success check if issue_slo_rules lint is valid 1'
] = {
  name: 'slo-rules-check',
  head_sha: 'c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a',
  conclusion: 'success',
};

exports[
  'slo-status-label Checking for compliant settings given a slo applies to an issue repo level file exists with write contributer being valid responder Returns false and creates and adds label "OOSLO" if no valid responder was assigned 1'
] = {
  name: 'OOSLO',
  color: 'ff6f6f',
  description: 'Issue is out of slo',
};

exports[
  'slo-status-label Checking for compliant settings given a slo applies to an issue repo level file exists with write contributer being valid responder Returns false and creates and adds label "OOSLO" if no valid responder was assigned 2'
] = {
  labels: ['OOSLO'],
};

exports[
  'slo-status-label Checking for compliant settings given a slo applies to an issue repo level file exists with owner contributer being valid responder Error is recorded if fails to create OOSLO label 1'
] = {
  name: 'OOSLO',
  color: 'ff6f6f',
  description: 'Issue is out of slo',
};

exports[
  'slo-status-label Checking for compliant settings given a slo applies to an issue repo level file exists with owners path containing valid responder Error is recorded if fails to add label to OOSLO issue 1'
] = {
  labels: ['OOSLO'],
};
