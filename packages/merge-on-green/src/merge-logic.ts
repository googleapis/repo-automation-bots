 
/**
 * Copyright 2020 Google LLC. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/*
const { App } = require("@octokit/app");
const Octokit = require("@octokit/rest");
const dotenv = require("dotenv")
const fs = require('fs');
// contains the installation id necessary to authenticate as an installation


const owner = 'sofisl';
const repo = 'hello-world'
const pr = 31
const labelName = 'merge-on-green ready';


//have to authenticate first

    async function getLatestCommit() {
        try {
        const data = await octokit.pulls.listCommits({
            owner: owner, //this will be filled in by context of payload, i.e., context.payload.repository.owner.login
            repo: repo, //this will be filled in by context of payload, i.e., context.payload.repository.name
            pull_number: pr, //what we're listening for,
            per_page: 100,
            page: 1     
        })
        return (data.data[(data.data.length)-1].sha);
    } catch(err) {
            return null;
        }
    }

    async function getPR() {
        const data = await octokit.pulls.get({
            owner: owner,
            repo: repo,
            pull_number: pr
        })
    
       return data.data;
    }


async function getMOGLabel() {    
    let isMOG = false;
    try {
    const labels = await octokit.issues.listLabelsOnIssue({
        owner: owner,
        repo: repo,
        issue_number: pr
    })
    const labelArray = labels.data;
    if (labelArray) {
    labelArray.forEach(element => {
        if(element.name === labelName) {
            isMOG = true;
        } else {
            isMOG = false;
        }
    })
    }
    //console.log(isMOG);
    return isMOG;
    } catch(err) {
        return null;
    } 
}


async function getRepoContents() {
    try{
    const configFile = await octokit.repos.getContents({
        owner: owner,
        repo: repo,
        path: //path
    })
    let buf = Buffer.from(configFile.data.content, 'base64');
    let decodedString = buf.toString('utf-8');
    return decodedString;
}
    catch(err) {
        console.log(err);
        return null;
    }
}

async function transformRepoContents() {
   const repoContents = await getRepoContents();
   //do something to repoContents, return array of required tests
}


async function getStatusi() {
    const head_sha = await getLatestCommit();
    console.log(head_sha);
    try {
        const data = await octokit.repos.listStatusesForRef({
            owner: owner,
            repo: repo,
          ref: head_sha,
          per_page: 100
     }); 
        return data.data;
    } catch(err) {
        return null;
    }
}

async function getSuites() {
    const head_sha = await getLatestCommit();
    try {
    const check_suites = await octokit.checks.listSuitesForRef({
        owner: owner,
        repo: repo,
        ref: head_sha,
        per_page: 100
    })
    return check_suites.data.check_suites;
} catch(err) {
    return null;
}
}

async function getRuns() {
    const head_sha = await getLatestCommit();
    try {
        const check_runs = await octokit.checks.listForRef({
            owner: owner,
        repo: repo,
        ref: head_sha,
        per_page: 100
          })
          return check_runs.data.check_runs;
    } catch(err) {
        return null;
    }
}

function checkForRequiredSC(checkSuitesOrRuns, check) {
    let mergeable = false;
    if (checkSuitesOrRuns != null) {
    let checkSuiteorRunCompleted = checkSuitesOrRuns.find(element => element.name === check)
        if (checkSuiteorRunCompleted!= undefined && checkSuiteorRunCompleted.conclusion ==='success') {
            console.log('e');
            mergeable = true;
            return mergeable;
        }     
    }
    return mergeable;
}



async function statusesForRef() {
          const head_sha = await getLatestCommit();
          const mogLabel = await getMOGLabel();
          const checkStatus = await getStatusi();
          const requiredChecks = await transformRepoContents();
          let mergeable = true;
          //console.log(checkStatus);
           if (checkStatus != null && head_sha != null && requiredChecks != null && mogLabel != false && mogLabel != null) {
            for (let check of requiredChecks) {
                console.log('a');
                console.log(mogLabel);
                //since find function finds the value of the first element in the array, that will take care of the chronological order of the tests
                let checkCompleted = checkStatus.find(element => element.context === check)
                if(checkCompleted === undefined) {
                    console.log('b');
                        //if we can't find it in the statuses, let's check under check_suites
                        let checkSuites = await getSuites();
                        mergeable = checkForRequiredSC(checkSuites, check);
                        //if we can't find it in the suites, let's check under check_runs
                        if (!mergeable) {
                            console.log('c');
                            let checkRuns = await getRuns();
                            mergeable = checkForRequiredSC(checkRuns, check);
                            if (!mergeable) {
                                console.log('d');
                                return mergeable;     
                            }
                        }                  
                } else if(checkCompleted.state != 'success') {
                    console.log('f');
                    mergeable = false;
                    return mergeable;
                } 
            }
        } else {
            mergeable = false;
            return mergeable;
        }
        //console.log('g '+mergeable);
        return mergeable;
}

 async function getReviewsCompleted() {
    try {    
        const reviewsCompleted = await octokit.pulls.listReviews({
        owner: owner,
        repo: repo,
        pull_number: pr
      })
      return reviewsCompleted.data;
    } catch(err) {
        return null;
    }
}

async function getReviewsRequested() {
    try {    
        const reviewsRequested = await octokit.pulls.listReviewRequests({
            owner: owner,
            repo: repo,
            pull_number: pr
          })
      return reviewsRequested.data;
    } catch(err) {
        return null;
    }
}

//this function cleans the reviews, since the listReviews method github provides returns a complete history of all comments added
//and we just want the most recent for each reviewer
function cleanReviews(reviewsCompleted) {
    let cleanReviews = [];
    let distinctReviewers = [];
    for (let x=(reviewsCompleted.length)-1; x>=0; x--) {
        let reviewsCompletedUser = reviewsCompleted[x].user.login
        if(!(distinctReviewers.includes(reviewsCompletedUser))) {
            cleanReviews.push(reviewsCompleted[x]);
            distinctReviewers.push(reviewsCompletedUser);
        }
    }
    return cleanReviews;
}


 

async function checkReviews() {
    let reviewsPassed = true;
        const reviewsCompletedDirty = await getReviewsCompleted();
        const reviewsRequested = await getReviewsRequested(); 
        
        const reviewsCompleted = cleanReviews(reviewsCompletedDirty);
        //console.log(reviewsCompleted);
        if (reviewsCompleted != null && reviewsCompleted.length != 0) {
            reviewsCompleted.forEach(review => {
                if (review.state != 'APPROVED'){
                    //so, if someone comments we will not merge the PR. Is that the right logic? or should we submit as a check-back?
                    reviewsPassed = false;
                } 
            }) 
          } 
            if (reviewsRequested != null && (reviewsRequested.users.length != 0 || reviewsRequested.teams.length != 0)) {
                reviewsPassed = false;
                return reviewsPassed;
            }
    return reviewsPassed;  
}


async function merge() {
   const commitInfo = await getPR();
    try {
    const merge = await octokit.pulls.merge({
        owner: owner,
        repo: repo,
        pull_number: pr,
        commit_title: commitInfo.title,
        commit_message: commitInfo.body,
        merge_method: 'squash'
    })
    return merge;
   } catch(err) {
       console.log(err);
        return null;
   }
}



// async function createParam() {
//     try {
//     const checkParams = octokit.checks.create({
//         owner: 'sofisl',
//         repo: 'mergeOnGreenTest',
//         name: 'merge-on-green-readiness', 
//         head_sha: '61a26441d1bb24f14b560fb3d019528457c8bfd6',
//         status: 'completed',
//         conclusion: 'failure',
//         output: {
//             title: 'Your PR was not mergeable.',
//             summary: 'Check your required status checks or requested reviews for failures.',
//             text:
//               'Your PR was not mergeable because either one of your required status checks failed, or one of your required reviews was not approved.' +
//               'Please fix your mistakes, and merge-on-green will run again to attempt to merge it automatically.' 
//           },
//     })
// } catch(err){
//     return null;
// }
// }

async function finalize() {
    let checkReview = await checkReviews();
    let checkStatus = await statusesForRef();
    if (checkReview === true && checkStatus === true) {
        merge();
        //console.log('FINAL: passed')
        //TODO: if merge is unsuccessful, tell the user
    } else  {
        //console.log('FINAL: failed');
    }
}
//finalize();
getRepoContents();
//TODO: Fill in details on how to get config file
*/