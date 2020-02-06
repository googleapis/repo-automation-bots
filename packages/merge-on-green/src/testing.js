const { App } = require("@octokit/app");
const Octokit = require("@octokit/rest");

async function createStatus() {
    const data = octokit.repos.createStatus({
        owner: 'sofisl', 
        repo: 'hello-world',
        sha: '184d2ad58fdd96ab93cd4695454dbfe248d47952',
        state: 'success'
    })
}


async function getPR() {
    const data = await octokit.pulls.get({
        owner: 'sofisl',
        repo: 'hello-world',
        pull_number: 29
    })

    console.log(data);
}

createStatus();