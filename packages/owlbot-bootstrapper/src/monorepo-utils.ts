import { parseSecretInfo } from './authenticate-github';
import {execSync} from 'child_process';

export async function cloneRepo(projectId: string, repoToClone: string) {
    const authValues = await parseSecretInfo(projectId);
    const jwt = execSync(`jwt encode --secret "@${authValues.secret}" --iss "${authValues.appId}" --exp "+10 min" --alg RS256`);
    const githubToken = execSync(`curl -X POST \
      -H "Authorization: Bearer ${jwt}" \
      -H "Accept: application/vnd.github.v3+json" \
      https://api.github.com/app/installations/$GITHUB_APP_INSTALLATION_ID/access_tokens \
      | jq -r .token`)
    execSync(`git clone https://x-access-token:${githubToken}@${repoToClone}`);
  }

export async function openBranch() {
    execSync(`git checkout -b owlbot-googleapis-initial-PR`);
}
  
export function isMonoRepo(language: string | undefined) {
    const monoRepos = ['dotnet', 'php', 'ruby'];
    if (!language) {
      throw Error('Language not specified for error');
    }
    if (monoRepos.includes(language)) {
      return true;
    }
    return false;
  }

export async function commitAndPushChanges(branchName: string) {
    execSync(`git commit -a -m 'feat: initial generation of library`);
    execSync(` git push --set-upstream origin ${branchName}`)
}