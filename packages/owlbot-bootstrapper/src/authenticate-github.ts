// TODO: Write authentication method to GH
// Then wire it up before cloning repo for monorepo.
const FUNCTIONNAME = 'owlbot-bootstrapper'

  function getLatestSecretVersionName(projectId): string {
    const secretName = `projects/${projectId}/secrets/${FUNCTIONNAME}`;
    return `${secretName}/versions/latest`;
  }

  export async function parseSecretInfo(projectId) {
    const name = getLatestSecretVersionName(projectId);
    const [version] = await this.secretsClient.accessSecretVersion({
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