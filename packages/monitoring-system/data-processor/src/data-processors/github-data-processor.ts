// Copyright 2020 Google LLC
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
//
import {DataProcessor} from './data-processor-abstract';

interface GitHubRepository {
  name: string,
  owner: string
}

interface GitHubEvent {
  payloadHash: string,
  repository: GitHubRepository,
  event_type: string,
  timestamp: number,
  actor: string
}

/**
 * Collects and processes Events data from GitHub
 */
export class GitHubProcessor extends DataProcessor {
  
  public async collectAndProcess(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  private async listRepositories(): Promise<GitHubRepository[]> {
    throw new Error('Method not implemented.');
  }

  private async getPublicEventsForRepository(repository: GitHubRepository): Promise<GitHubEvent[]> {
    // https://octokit.github.io/rest.js/v18#activity-list-repo-events
    throw new Error('Method not implemented.');
  }

  private async storeEventsData(events: GitHubEvent[]): Promise<void> {
    throw new Error('Method not implemented.');
  }

  private iso8601TimeToEpoch(iso8601Timestamp: string): number {
    throw new Error('Method not implemented.');
  }

}
