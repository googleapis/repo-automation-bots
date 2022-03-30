import {execSync} from 'child_process';
import {v1 as SecretManagerV1} from '@google-cloud/secret-manager';
import {Octokit} from '@octokit/rest';
import {createAppAuth} from '@octokit/auth-app';
import {logger} from 'gcf-utils';
import {sign} from 'jsonwebtoken';
import {request} from 'gaxios';

export const SECRET_NAME_APP = 'owlbot-bootstrapper-app';
export const SECRET_NAME_INDIVIDUAL = 'owlbot-bootstrapper';

export async function setConfig() {
  execSync('git config --global user.name "Googleapis Bootstrapper"');
  execSync(
    'git config --global user.email "googleapis-bootstrapper[bot]@users.noreply.github.com"'
  );
  execSync(
    "git config --global credential.helper 'store --file /workspace/.git-credentials'"
  );
}

function getLatestSecretVersionName(
  projectId: string,
  secretName: string
): string {
  const fullSecretName = `projects/${projectId}/secrets/${secretName}`;
  return `${fullSecretName}/versions/latest`;
}

export async function parseSecretInfo(projectId: string, secretName: string) {
  const secretsClient = new SecretManagerV1.SecretManagerServiceClient();
  const name = getLatestSecretVersionName(projectId, secretName);
  const [version] = await secretsClient.accessSecretVersion({
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

export async function authenticateOctokit(token: string) {
  return new Octokit({
    auth: token,
  });
}

export async function getGitHubShortLivedAccessToken(
  privateKey: string,
  appInstallationId: number,
  appId: number
) {
  const payload = {
    // issued at time
    // Note: upstream API seems to fail if decimals are included
    // in unixtime, this is why parseInt is run:
    iat: parseInt('' + Date.now() / 1000),
    // JWT expiration time (10 minute maximum)
    exp: parseInt('' + Date.now() / 1000 + 10 * 60),
    // GitHub App's identifier
    iss: appId,
  };
  const jwt = sign(payload, privateKey, {algorithm: 'RS256'});
  const resp = await request({
    url: `https://api.github.com/app/installations/${appInstallationId}/access_tokens`,
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
