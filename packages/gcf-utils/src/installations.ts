// Copyright 2023 Google LLC
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

import {WrapConfig} from './configuration';
import {getAuthenticatedOctokit} from './gcf-utils';

// Helper interface to abstract the response of the list installations GitHub response
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

/**
 * Async iterator over each installation for an app.
 *
 * See https://docs.github.com/en/rest/reference/apps#list-installations-for-the-authenticated-app
 * @param wrapConfig {WrapConfig}
 */
export async function* eachInstallation(
  wrapConfig: WrapConfig
): AsyncGenerator<AppInstallation, void, void> {
  const octokit = await getAuthenticatedOctokit(undefined);
  const installationsPaginated = octokit.paginate.iterator(
    octokit.apps.listInstallations as any
  );
  for await (const response of installationsPaginated) {
    for (const installation of response.data) {
      yield {
        id: installation.id,
        suspended: installation.suspended_at !== null,
        targetType: installation.target_type,
        login: installation.account?.login,
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
export async function* eachInstalledRepository(
  installationId: number,
  wrapConfig: WrapConfig
): AsyncGenerator<InstalledRepository, void, void> {
  const octokit = await getAuthenticatedOctokit(installationId);
  const installationRepositoriesPaginated = octokit.paginate.iterator(
    octokit.apps.listReposAccessibleToInstallation as any,
    {
      mediaType: {
        previews: ['machine-man'],
      },
    }
  );
  for await (const response of installationRepositoriesPaginated) {
    for (const repo of response.data) {
      yield {
        id: repo.id,
        archived: repo.archived,
        disabled: repo.disabled,
        fullName: repo.full_name,
      };
    }
  }
}
