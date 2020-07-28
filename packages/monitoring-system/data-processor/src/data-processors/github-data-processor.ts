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
import {DataProcessor, ProcessorOptions} from './data-processor-abstract';
import {Octokit} from '@octokit/rest';
import {WriteResult} from '@google-cloud/firestore';
import md5 from 'md5';

export interface GitHubProcessorOptions extends ProcessorOptions {
  octokit?: Octokit;
}

interface GitHubRepository {
  repo_name: string;
  owner_name: string;
  owner_type?: 'org' | 'user' | 'Unknown';
}

export interface GitHubEvent {
  payload_hash: string;
  repository: GitHubRepository;
  event_type: string;
  timestamp: number;
  actor: string;
}

interface GitHubEventResponse {
  type: string;
  repo: {
    name: string;
  };
  actor: {
    login: string;
  };
  payload: {};
  created_at: string;
  org?: {};
  user?: {};
}

/**
 * Collects and processes Events data from GitHub
 */
export class GitHubProcessor extends DataProcessor {
  private octokit: Octokit;

  constructor(options?: GitHubProcessorOptions) {
    super(options);
    this.octokit = options?.octokit || new Octokit();
  }

  /**
   * Collect and process GitHub Events data
   */
  public async collectAndProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.listRepositories()
        .then(repos => {
          return Promise.all(
            repos.map(repo => {
              return this.listPublicEventsForRepository(repo);
            })
          );
        })
        .then((allRepoEvents: GitHubEvent[][]) => {
          const allRepoEventsFlattened = ([] as GitHubEvent[]).concat(
            ...allRepoEvents
          );
          return this.storeEventsData(allRepoEventsFlattened);
        })
        .then(() => resolve())
        .catch(error => {
          reject(new Error(`Failed to process GitHub Events data: ${error}`));
        });
    });
  }

  /**
   * List the GitHub repositories that have triggered
   * bot executions in the past
   */
  private async listRepositories(): Promise<GitHubRepository[]> {
    return this.firestore
      .collection('GitHub_Repository')
      .get()
      .then(repositoryCollection => {
        const repositoryDocs = repositoryCollection.docs;
        return repositoryDocs.map(
          repoDoc => repoDoc.data() as GitHubRepository
        );
      });
  }

  /**
   * Get all the publicly visible Events on the given repository
   * @param repository repository for which to get events
   */
  private async listPublicEventsForRepository(
    repository: GitHubRepository
  ): Promise<GitHubEvent[]> {
    return this.octokit.activity
      .listRepoEvents({
        repo: repository.repo_name,
        owner: repository.owner_name,
      })
      .then(eventsPayload => {
        if (!(eventsPayload instanceof Array)) {
          throw new Error(`Unexpected payload from Octokit: ${eventsPayload}`);
        }
        const gitHubEvents: GitHubEvent[] = [];
        for (const event of eventsPayload) {
          gitHubEvents.push(
            this.githubEventResponseToEvent(
              (event as unknown) as GitHubEventResponse
            )
          );
        }
        return gitHubEvents;
      });
  }

  private githubEventResponseToEvent(
    eventResponse: GitHubEventResponse
  ): GitHubEvent {
    const {type, repo, payload, created_at, org, user} = eventResponse;

    if (!payload) {
      throw new Error(`Invalid event response from GitHub: ${eventResponse}`);
    }
    const payload_hash = md5(JSON.stringify(payload));

    const [owner_name, repo_name] = repo?.name?.split('/');
    const unixTimestamp = new Date(created_at).getTime();

    return {
      payload_hash: payload_hash,
      repository: {
        repo_name: repo_name || 'Unknown',
        owner_name: owner_name || 'Unknown',
        owner_type: org ? 'org' : user ? 'user' : 'Unknown',
      },
      event_type: type || 'Unknown',
      timestamp: unixTimestamp,
      actor: eventResponse.actor?.login || 'Unknown',
    };
  }

  /**
   * Store the given events data into Firestore. Existing events with the same payload
   * hash will be overwritten
   * @param events events data to store
   */
  private async storeEventsData(events: GitHubEvent[]): Promise<WriteResult[]> {
    const eventsRepoKeyOnly = events.map(event => {
      const {repo_name, owner_name, owner_type} = event.repository;
      return {
        ...event,
        repository: `${repo_name}_${owner_name}_${owner_type}`,
      };
    });
    const collection = this.firestore.collection('GitHub_Event');
    return Promise.all(
      eventsRepoKeyOnly.map(event =>
        collection.doc(event.payload_hash).set(event)
      )
    );
  }
}
