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
import {Octokit} from '@octokit/rest';
import { Firestore } from '@google-cloud/firestore';

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
  
  octokit: Octokit;

  constructor(firestore?: Firestore, octokit?: Octokit) {
    super(firestore);
    this.octokit = octokit || new Octokit();
  }
  
  /**
   * Collect and process GitHub Events data
   */
  public async collectAndProcess(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  /**
   * List the GitHub repositories that have triggered 
   * bot executions in the past
   */
  private async listRepositories(): Promise<GitHubRepository[]> {
    throw new Error('Method not implemented.');
  }

  /**
   * Get all the publicly visible Events on the given repository
   * @param repository repository for which to get events
   */
  private async listPublicEventsForRepository(repository: GitHubRepository): Promise<GitHubEvent[]> {
    // https://octokit.github.io/rest.js/v18#activity-list-repo-events
    throw new Error('Method not implemented.');
  }

  /**
   * Store the given events data into Firestore. Existing events with the same payload
   * hash will be overwritten
   * @param events events data to store
   */
  private async storeEventsData(events: GitHubEvent[]): Promise<void> {
    throw new Error('Method not implemented.');
  }

  /**
   * Convert the given ISO 8601 timestamp (in UTC) to UNIX time
   * @param iso8601Timestamp 
   */
  private iso8601ToUnixTime(iso8601Timestamp: string): number {
    throw new Error('Method not implemented.');
  }

}
