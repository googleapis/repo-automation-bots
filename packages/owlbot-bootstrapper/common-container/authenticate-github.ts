import {execSync} from 'child_process';
import {v1 as SecretManagerV1} from '@google-cloud/secret-manager';
import {Octokit} from '@octokit/rest';
import {createAppAuth} from '@octokit/auth-app';

export const SECRET_NAME_APP = 'owlbot-bootstrapper-app';
export const SECRET_NAME_INDIVIDUAL = 'owlbot-bootstrapper';

export async function setConfig() {
  execSync('git config --global user.name "Googleapis Bootstrapper"');
  execSync(
    'git config --global user.email "googleapis-bootstrapper[bot]@users.noreply.github.com"'
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
  asInstallation: boolean,
  secretValues: any,
  installationId?: string
) {
  if (asInstallation) {
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
      auth: secretValues.privateToken,
    });
  }
}

export async function getAccessTokenFromInstallation(
  projectId: string,
  appInstallationId: string
) {
  const authValues = await parseSecretInfo(projectId, SECRET_NAME_APP);

  const appOctokit = await authenticateOctokit(
    true,
    authValues,
    appInstallationId
  );

  const token = (
    await appOctokit.request(
      `POST /app/installations/${appInstallationId}/access_tokens`,
      {
        installation_id: appInstallationId,
      }
    )
  ).data.token;

  console.log(token);

  return token;
}

export async function saveCredentialsToGitWorkspace(githubToken: string) {
  console.log(`Entering save credentials to git workspace: ${githubToken}`);
  execSync(
    `echo https://x-access-token:${githubToken}@github.com >> /workspace/.git-credentials`
  );
  execSync(
    "git config --global credential.helper 'store --file /workspace/.git-credentials'"
  );
}
