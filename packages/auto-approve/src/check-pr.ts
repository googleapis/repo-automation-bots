import {ProbotOctokit} from 'probot';
import {operations} from '@octokit/openapi-types';
type PullsListFilesResponseData = operations['pulls/list-files']['responses']['200']['application/json'];

interface validPR {
    author: string,
    title: string, 
    changedFiles?: string[],
    maxFiles?: number
}
//fix pr any type to correct type
export async function checkPRAgainstConfig(config: validPR[], pr: any, octokit: InstanceType<typeof ProbotOctokit>, owner: string, repo: string, prNumber: number): Promise<Boolean> {
    const validTypeOfPR = config.find(x => x.author === pr.user.login); 
    if (validTypeOfPR) {
        if (validTypeOfPR.changedFiles) {
            const changedFiles = await getChangedFiles(octokit, owner, repo, prNumber);
            const filesMatch = checkFilePathsMatch(changedFiles, validTypeOfPR);
        } 
        //check if Valid number of max files
        if (validTypeOfPR.maxFiles) {
            const numberOfFiles = 
        }
    } else {
        return false;
    }
}

export function checkFilePathsMatch(prFiles: string[], validTypeOfPR: validPR) {
    let filesMatch = true;
    for (const file of prFiles) {
       for (const pattern of validTypeOfPR.changedFiles!) {
            if (pattern.includes('^') || pattern.includes('$')) {
                if (!file.match(pattern)) {
                    filesMatch = false;
                }             
            } else {
                if (file !== pattern) {
                    filesMatch = false;
                }       
            }
       }
    }

    return filesMatch;
}

export async function getChangedFiles(octokit: InstanceType<typeof ProbotOctokit>, owner: string, repo: string, prNumber: number) {
    const changedFiles = await octokit.pulls.listFiles({
        owner,
        repo, 
        pull_number: prNumber
    });

    return changedFiles.data.map(x => x.filename);

}