// Copyright 2022 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * Language enum representing all languages that use owlbot-bootstrapper
 */
export enum Language {
  Nodejs = 'nodejs',
  Python = 'python',
  Java = 'java',
  Ruby = 'ruby',
  Php = 'php',
  Dotnet = 'dotnet',
}

/**
 * Secret interface from secret manager for a bot
 */
export interface Secret {
  privateKey: string;
  appId: string;
  secret: string;
}

/**
 * CLI arguments
 */
export interface CliArgs {
  projectId: string;
  triggerId?: string;
  apiId: string;
  repoToClone?: string;
  language: string;
  installationId: string;
  buildId?: string;
}

export interface InterContainerVars extends ApiFields {
  branchName: string;
  owlbotYamlPath: string;
}

// These API fields will
export interface ApiFields {
  // API short name (e.g., accessapproval)
  apiShortName: string;
  // API pretty or full name (e.g., Access Approval API)
  apiPrettyName?: string;
  // Product documentation (e.g., https://cloud.google.com/cloud-provider-access-management/access-approval/docs)
  apiProductDocumentation?: string;
  // Client documentation (e.g., https://cloud.google.com/nodejs/docs/reference/access-approval/latest)
  apiClientDocumentation?: string;
  // API Issue tracker (e.g., https://issuetracker.google.com/issues/new?component=190865&template=1161103)
  apiIssueTracker?: string;
  // API Release level or launch stage (e.g., Beta)
  apiReleaseLevel?: string;
  // API ID (as described by 'name' in api_proto.yaml)
  // This is confusing notation as we also have apiId which refers to the unique identifier (see ID: https://raw.githubusercontent.com/googleapis/googleapis/master/api-index-v1.json)
  // But most .repo-metadata.json files use apiId to refer to something that looks like the host name
  // See internal doc https://docs.google.com/document/d/1IUpyM_V-LOC3OUSlkcG5GgqNzjQ5qnnlkEF9gu2kJR4/edit#heading=h.x9snb54sjlu9
  apiId?: string;
}

// Interface for what is grabbed from DRIFT
export interface DriftApi {
  // API name as it shows in path
  api_shortname: string;
  // API name pretty
  display_name: string;
  // URL to get docs from
  docs_root_url: string;
  // Launch stage of API
  launch_stage: string;
}

export interface GHFile {
  content: string | undefined;
}

export interface GHDir {
  name: string;
}

export enum ReleaseLevel {
  LAUNCH_STAGE_UNSPECIFIED = 'LAUNCH_STAGE_UNSPECIFIED',
  UNIMPLEMENTED = 'UNIMPLEMENTED',
  PRELAUNCH = 'PRELAUNCH',
  EARLY_ACCESS = 'EARLY_ACCESS',
  ALPHA = 'ALPHA',
  BETA = 'BETA',
  GA = 'GA',
  DEPRECATED = 'DEPRECATED',
}
