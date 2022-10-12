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
  monoRepoPath: string;
  serviceConfigPath: string;
  interContainerVarsPath: string;
}

export interface InterContainerVars {
  branchName: string;
  owlbotYamlPath: string;
}
