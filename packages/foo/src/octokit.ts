import {Octokit} from '@octokit/rest';
import {createAppAuth} from '@octokit/auth-app';
import {BotSecrets} from './secrets/secret-loader';

/**
 * A helper for getting an Octokit instance authenticated as an App.
 *
 * Note that it only provides an Octokit instance with a JWT token
 * when installationId is not provided. This Octokit only allows you
 * to call limited APIs including listing installations.
 *
 * Github Apps should provide installationId whenever possible.
 */
export function getAuthenticatedOctokit(
  botSecrets: BotSecrets,
  installationId?: number
): Octokit {
  if (installationId === undefined || installationId === null) {
    // Authenticate as a bot.
    return new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: botSecrets.appId,
        privateKey: botSecrets.privateKey,
      },
    });
  }
  // Authenticate as an installation.
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: botSecrets.appId,
      privateKey: botSecrets.privateKey,
      installationId: installationId,
    },
  });
}

export class OctokitFactory {
  private botSecrets: BotSecrets;
  private clientCache: Record<string, Octokit> = {};

  constructor(botSecrets: BotSecrets) {
    this.botSecrets = botSecrets;
  }

  getInstallationOctokit(installationId: number): Octokit {
    const cacheKey = installationId.toString();
    if (!this.clientCache[cacheKey]) {
      this.clientCache[cacheKey] = getAuthenticatedOctokit(
        this.botSecrets,
        installationId
      );
    }
    return this.clientCache[cacheKey];
  }

  getAppOctokit(): Octokit {
    const cacheKey = '';
    if (!this.clientCache[cacheKey]) {
      this.clientCache[cacheKey] = getAuthenticatedOctokit(this.botSecrets);
    }
    return this.clientCache[cacheKey];
  }
}
