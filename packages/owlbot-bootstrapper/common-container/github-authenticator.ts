import {SecretManagerServiceClient} from '@google-cloud/secret-manager';
import {Octokit} from '@octokit/rest';
import {sign} from 'jsonwebtoken';
import {Secret} from './interfaces';
import {request} from 'gaxios';

export class GithubAuthenticator {
  projectId: string;
  appInstallationId: string;
  secretManagerClient: SecretManagerServiceClient;
  OWLBOT_SECRET_NAME = 'owlbot-bootstrapper';

  constructor(
    projectId: string,
    appInstallationId: string,
    secretManagerClient: SecretManagerServiceClient
  ) {
    this.projectId = projectId;
    this.appInstallationId = appInstallationId;
    this.secretManagerClient = secretManagerClient;
  }

  public async getGitHubShortLivedAccessToken(): Promise<string> {
    const secret = await this.parseSecretInfo(
      this.secretManagerClient,
      this.projectId,
      this.OWLBOT_SECRET_NAME
    );
    const payload = {
      // issued at time
      // Note: upstream API seems to fail if decimals are included
      // in unixtime, this is why parseInt is run:
      iat: parseInt('' + Date.now() / 1000),
      // JWT expiration time (10 minute maximum)
      exp: parseInt('' + Date.now() / 1000 + 10 * 60),
      // GitHub App's identifier
      iss: secret.appId,
    };
    const jwt = sign(payload, secret.privateKey, {algorithm: 'RS256'});
    const resp = await request({
      url: `https://api.github.com/app/installations/${this.appInstallationId}/access_tokens`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (resp.status !== 201) {
      throw Error(`unexpected response http = ${resp.status}`);
    } else {
      return (resp.data as any).token;
    }
  }

  public async authenticateOctokit(): Promise<Octokit> {
    const token = await this.getGitHubShortLivedAccessToken();
    return new Octokit({
      auth: token,
    });
  }

  private getLatestSecretVersionName(
    projectId: string,
    secretName: string
  ): string {
    const fullSecretName = `projects/${projectId}/secrets/${secretName}`;
    return `${fullSecretName}/versions/latest`;
  }

  private async parseSecretInfo(
    secretManagerClient: SecretManagerServiceClient,
    projectId: string,
    secretName: string
  ): Promise<Secret> {
    const name = this.getLatestSecretVersionName(projectId, secretName);
    const [version] = await secretManagerClient.accessSecretVersion({
      name: name,
    });

    // Extract the payload as a string.
    const payload = version?.payload?.data?.toString() || '';
    if (payload === '') {
      throw Error('did not retrieve a payload from SecretManager.');
    }
    const config = JSON.parse(payload);
    return config;
  }
}
