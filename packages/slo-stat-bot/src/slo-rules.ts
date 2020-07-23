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

enum Priority {
    'P0',
    'P1',
    'P2',
    'P3',
    'P4',
    'P5',
  }
  
export interface SLORules {
    appliesTo: {
        gitHubLabels?: string | string[];
        excludedGitHubLabels?: string | string[];
        priority?: Priority;
        issueType?: string;
        issues?: boolean;
        prs?: boolean;
    };
    complianceSettings: {
        responseTime: string | number;
        resolutionTime: string | number;
        requiresAssignee?: boolean;
        responders?: {
        owners?: string | string[];
        contributors?: string;
        users?: string[];
        };
    };
}