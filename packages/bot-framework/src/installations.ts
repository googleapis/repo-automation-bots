// Copyright 2023 Google LLC
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

import {OctokitFactory} from './octokit';

export interface AppInstallation {
  // App installation id
  id: number;
  // Installation type (e.g. `Organization`)
  targetType: string;
  // Whether or not the installation is suspended
  suspended?: boolean;
  // Installation owner (organization/user name)
  login?: string;
}

// Helper interface to abstract the response of the list repositories for an app
// installation GitHub response
export interface InstalledRepository {
  // Installation repository id
  id: number;
  // Whether or not the repository is archived
  archived: boolean;
  // Whether or not the repository is disabled
  disabled: boolean;
  // Name of the repository in the format of <owner>/<repo>
  fullName: string;
}

export interface InstallationHandler {
  eachInstallation(): AsyncGenerator<AppInstallation, void, void>;
  eachInstalledRepository(
    installationId: number
  ): AsyncGenerator<InstalledRepository, void, void>;
}

export class OctokitInstallationHandler implements InstallationHandler {
  private octokitFactory: OctokitFactory;

  constructor(octokitFactory: OctokitFactory) {
    this.octokitFactory = octokitFactory;
  }

  /**
   * Async iterator over each installation for an app.
   *
   * See https://docs.github.com/en/rest/reference/apps#list-installations-for-the-authenticated-app
   * @param wrapConfig {WrapConfig}
   */
  async *eachInstallation(): AsyncGenerator<AppInstallation, void, void> {
    const octokit = this.octokitFactory.getAppOctokit();
    const installationsPaginated = octokit.paginate.iterator(
      octokit.apps.listInstallations
    );
    for await (const response of installationsPaginated) {
      for (const installation of response.data) {
        yield {
          id: installation.id,
          suspended: installation.suspended_at !== null,
          targetType: installation.target_type,
          login: (installation.account as {login?: string}).login,
        };
      }
    }
  }

  /**
   * Async iterator over each repository for an app installation.
   *
   * See https://docs.github.com/en/rest/reference/apps#list-repositories-accessible-to-the-app-installation
   * @param wrapConfig {WrapConfig}
   */
  async *eachInstalledRepository(
    installationId: number
  ): AsyncGenerator<InstalledRepository, void, void> {
    const octokit = this.octokitFactory.getInstallationOctokit(installationId);
    const installationRepositoriesPaginated = octokit.paginate.iterator(
      octokit.apps.listReposAccessibleToInstallation,
      {
        mediaType: {
          previews: ['machine-man'],
        },
      }
    );
    for await (const response of installationRepositoriesPaginated) {
      for (const repo of response.data.repositories) {
        if (repo.archived === true || repo.disabled === true) {
          continue;
        }
        yield {
          id: repo.id,
          archived: repo.archived,
          disabled: repo.disabled,
          fullName: repo.full_name,
        };
      }
    }
  }
}
