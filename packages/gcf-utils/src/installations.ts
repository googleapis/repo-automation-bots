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
import {
  GCFLogger,
  getAuthenticatedOctokit,
  logger as defaultLogger,
} from './gcf-utils';

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

export interface BaseWebhook {
  installation?: {
    id: number;
  };
}
export function parseInstallationId(body: BaseWebhook): number | undefined {
  return body.installation?.id;
}

export interface InstallationHandlerOptions {
  organizationAllowlist?: Set<string>;
  organizationBlocklist?: Set<string>;
  logger?: GCFLogger;
}
export class InstallationHandler {
  private organizationAllowlist?: Set<string>;
  private organizationBlocklist?: Set<string>;
  private organizationByInstallationCache: Map<number, string>;
  constructor(options: InstallationHandlerOptions = {}) {
    this.organizationAllowlist = options.organizationAllowlist;
    this.organizationBlocklist = options.organizationBlocklist;
    this.organizationByInstallationCache = new Map();
  }

  async isOrganizationAllowed(
    installationId: number,
    logger: GCFLogger = defaultLogger
  ): Promise<boolean> {
    // If no organization allowlist or blocklist defined, then allow everything
    if (!this.organizationAllowlist && !this.organizationBlocklist) {
      logger.trace('No allowlist or disallowlist, passing');
      return true;
    }

    // Lookup organization name by installationId
    const organization = await this.organizationForInstallation(installationId);
    if (!organization) {
      // In the rare case we cannot determine the organization, allow the request and warn.
      logger.warn(
        `Failed to look up organization for installation: ${installationId}`
      );
      return true;
    }

    // Check the blocklist first if one is configured
    if (
      this.organizationBlocklist &&
      this.organizationBlocklist.has(organization)
    ) {
      logger.info(
        `Event for blocklisted organization: ${organization} (${installationId})`
      );
      return false;
    }

    // Ensure the organization is in the allowlist if one is configured
    if (
      this.organizationAllowlist &&
      !this.organizationAllowlist.has(organization)
    ) {
      logger.info(
        `Event for non-allowlisted organization: ${organization} (${installationId})`
      );
      return false;
    }

    // Passed all checks, allow the request
    return true;
  }

  // Read-through cache for determining the installed organization name given
  // the installationId. In rare cases, this may return undefined.
  async organizationForInstallation(
    installationId: number,
    logger: GCFLogger = defaultLogger
  ): Promise<string | undefined> {
    const cached = this.organizationByInstallationCache.get(installationId);
    if (cached) {
      logger.trace(`Found cached organization ${cached} (${installationId})`);
      return cached;
    }

    logger.debug(
      `Looking up organzation for installationId: ${installationId}`
    );
    const octokit = await getAuthenticatedOctokit(installationId);
    const installation = (
      await octokit.rest.apps.getInstallation({installation_id: installationId})
    ).data;
    if (installation.account) {
      const organization =
        installation.account['login'] ?? installation.account['slug'];
      this.organizationByInstallationCache.set(installationId, organization);
      logger.debug(`Found organization ${organization} (${installationId})`);
      return organization;
    }
    return undefined;
  }
}
