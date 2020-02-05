 
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

const { App } = require("@octokit/app");
const Octokit = require("@octokit/rest");
const dotenv = require("dotenv")
// contains the installation id necessary to authenticate as an installation



const octokit = new Octokit({
    auth() {
      return //fill inm with token;
    
   });

    async function getLatestCommit() {
        try {
        const data = await octokit.pulls.listCommits({
            owner: 'sofisl', //this will be filled in by context of payload, i.e., context.payload.repository.owner.login
            repo: 'mergeOnGreenTest', //this will be filled in by context of payload, i.e., context.payload.repository.name
            pull_number: '45', //what we're listening for,
            per_page: 100,
            page: 1     
        })
        return (data.data[(data.data.length)-1]);
    } catch(err) {
            return null;
        }
    }



async function getMOGLabel() {    
    let isMOG = false;
    try {
    const labels = await octokit.issues.listLabelsOnIssue({
        owner: 'sofisl',
        repo: 'mergeOnGreenTest',
        issue_number: 44
    })
    const labelArray = labels.data;
    if (labelArray) {
    labelArray.forEach(element => {
        if(element.name === 'merge-on-green ready') {
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

async function getStatusi() {
    try {
        const data = await octokit.repos.listStatusesForRef({
            owner: 'sofisl',
            repo: 'mergeOnGreenTest',
          ref: '61a26441d1bb24f14b560fb3d019528457c8bfd6', //head_sha
          per_page: 100
     }); 
        return data.data;
    } catch(err) {
        return null;
    }
}

async function getSuites() {
    try {
    const check_suites = await octokit.checks.listSuitesForRef({
        owner: 'sofisl',
        repo: 'mergeOnGreenTest',
        ref: '61a26441d1bb24f14b560fb3d019528457c8bfd6',
        per_page: 100
    })
    return check_suites.data.check_suites;
} catch(err) {
    return null;
}
}

async function getRuns() {
    try {
        const check_runs = await octokit.checks.listForRef({
            owner: 'sofisl',
        repo: 'mergeOnGreenTest',
        ref: '61a26441d1bb24f14b560fb3d019528457c8bfd6',
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
            mergeable = true;
            return mergeable;
        }     
    }
    return mergeable;
}

const requiredChecks = ['alwaysGreen'];

async function statusesForRef() {
          const head_sha = await getLatestCommit();
          const mogLabel = true;
          //await getMOGLabel();
          const checkStatus = await getStatusi();
          let mergeable = true;
           if (checkStatus != null && head_sha != null && requiredChecks != null && (mogLabel != false || mogLabel != null)) {
            for (let check of requiredChecks) {
                //since find function finds the value of the first element in the array, that will take care of the chronological order of the tests
                let checkCompleted = checkStatus.find(element => element.context === check)
                if(checkCompleted === undefined) {
                        //if we can't find it in the statuses, let's check under check_suites
                        let checkSuites = await getSuites();
                        mergeable = checkForRequiredSC(checkSuites, check);
                        //if we can't find it in the suites, let's check under check_runs
                        if (!mergeable) {
                            let checkRuns = await getRuns();
                            mergeable = checkForRequiredSC(checkRuns, check);
                            if (!mergeable) {
                                return mergeable;     
                            }
                        }                  
                } else if(checkCompleted.state != 'success') {
                    mergeable = false;
                    return mergeable;
                } 
            }
        }
        console.log(mergeable);
        return mergeable;
}

 async function getReviewsCompleted() {
    try {    
        const reviewsCompleted = await octokit.pulls.listReviews({
        owner: 'sofisl',
        repo: 'mergeOnGreenTest',
        pull_number: 44
      })
      return reviewsCompleted.data;
    } catch(err) {
        return null;
    }
}

async function getReviewsRequested() {
    try {    
        const reviewsRequested = await octokit.pulls.listReviewRequests({
            owner: 'sofisl',
            repo: 'mergeOnGreenTest',
            pull_number: 44
          })
      return reviewsRequested.data;
    } catch(err) {
        return null;
    }
}


async function checkReviews() {
    let reviewsPassed = true;
        const reviewsCompleted = await getReviewsCompleted();
        const reviewsRequested = await getReviewsRequested(); 

        if (reviewsCompleted != null) {
            for (const review in reviewsCompleted) {
                if (review.state != 'APPROVED'){
                    //so, if someone comments we will not merge the PR. Is that the right logic? or should we submit as a check-back?
                    reviewsPassed = false;
                } 
            } 
          } else {
            if (reviewsRequested != null && (reviewsRequested.users.length != 0 || reviewsRequested.teams.length != 0)) {
                reviewsPassed = false;
                return reviewsPassed;
            }
        }
    return reviewsPassed;  
}

//checkReviews('success');


async function merge() {
    try {
    const merge = octokit.pulls.merge({
        owner: 'sofisl',
        repo: 'mergeOnGreenTest',
        pull_number: 45
    })
    return merge;
   } catch(err) {
        return null;
   }
}

async function createParam() {
    try {
    const checkParams = octokit.checks.create({
        owner: 'sofisl',
        repo: 'mergeOnGreenTest',
        name: 'merge-on-green_readiness', 
        head_sha: '61a26441d1bb24f14b560fb3d019528457c8bfd6',
        status: 'completed',
        conclusion: 'failure',
        output: {
            title: 'Your PR was not mergeable.',
            summary: 'Check your required status checks or requested reviews for failures.',
            text:
              'Your PR was not mergeable because either one of your required status checks failed, or one of your required reviews was not approved.' +
              'Please fix your mistakes, and merge-on-green will run again to attempt to merge it automatically.' 
          },
    })
} catch(err){
    return null;
}
}

async function finalize() {
    let checkReview = await checkReviews();
    let checkStatus = await statusesForRef();
    if (checkReview === true && checkStatus === true) {
        merge();
        //TODO: if merge is unsuccessful, tell the user
    } else  {
        console.log('FINAL: failed');
    }
}
finalize();

//TODO: Get config file
//TODO: squash merge commit

