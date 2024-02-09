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
  apiId: string;
  repoToClone: string;
  language: string;
  installationId: string;
  monoRepoPath: string;
  monoRepoDir: string;
  monoRepoName: string;
  monoRepoOrg: string;
  serviceConfigPath: string;
  interContainerVarsPath: string;
  buildId: string;
  skipIssueOnFailure: string;
  sourceCl: number;
}

export interface InterContainerVars {
  branchName: string;
  owlbotYamlPath: string;
}

// Interface for service config yaml (internal): /depot/google3/google/api/client.proto
export interface ServiceConfigYaml {
  publishing: {
    api_short_name: string;
    github_label: string;
    documentation_uri: string;
    launch_stage: string;
  };
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
  launch_stage: ReleaseLevel;
  // Preferred github label
  github_label: string;
}

// Enum for release level for service config https://cloud.google.com/products#section-22
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
