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

export interface AppInstallation {
  id: number;
  targetType: string;
  suspended?: boolean;
  login?: string;
}

export interface InstalledRepository {
  id: number;
  archived: boolean;
  disabled: boolean;
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
  const octokit = await this.getAuthenticatedOctokit(undefined, wrapConfig);
  const installationsPaginated = octokit.paginate.iterator(
    octokit.apps.listInstallations
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
  const octokit = await this.getAuthenticatedOctokit(
    installationId,
    wrapConfig
  );
  const installationRepositoriesPaginated = octokit.paginate.iterator(
    octokit.apps.listReposAccessibleToInstallation,
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
