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
    'git config --global user.email "googleapis-bootsrapper[bot]@users.noreply.github.com"'
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

export async function authenticateOctokit(
  token: string,
  secretValues?: any,
  installationId?: string
) {
  if (installationId) {
    return new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: secretValues.appId,
        privateKey: secretValues.privateKey,
        installationId: installationId,
      },
    });
  } else {
    return new Octokit({
      auth: token,
    });
  }
}

export async function getAccessTokenFromInstallation(
  authValues: any,
  appInstallationId: string,
  repoName: string
) {
  const appOctokit = await authenticateOctokit(authValues, appInstallationId);

  const token = (
    await appOctokit.request(
      `POST /app/installations/${appInstallationId}/access_tokens`,
      {
        installation_id: appInstallationId,
        repositories: [repoName],
        permissions: {
          contents: 'admin',
          administration: 'write',
          pull_requests: 'write',
          organization_administration: 'write',
          issues: 'write',
          metadata: 'read',
        },
      }
    )
  ).data;

  return token.token;
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
    console.log((resp.data as any).token);
    return (resp.data as any).token;
  }
}

export async function saveCredentialsToGitWorkspace(githubToken: string) {
  // console.log(`Entering save credentials to git workspace: ${githubToken}`);
  // execSync(
  //   `echo https://x-access-token:${githubToken}@github.com >> /workspace/.git-credentials`
  // );
  // execSync(
  //   "git config --global credential.helper 'store --file /workspace/.git-credentials'"
  // );
  // console.log('read below for .git-credentials');
  // logger.info(execSync('cat .git-credentials').toString());
  // process.env.GITHUB_TOKEN = githubToken;
  // console.log(`GITHUB TOKEN: ${process.env.GITHUB_TOKEN}`);
}
