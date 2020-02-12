import { abortPendingRequests } from "nock/types";

 
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

const github = require('probot/lib/github');
const { App } = require("@octokit/app");
const Octokit = require("@octokit/rest");
const dotenv = require("dotenv")
const fs = require('fs');

interface Label {
    name: string
   }
   
   interface CheckRun {
       name: string,
       conclusion: string
   }
   
   interface CheckStatus {
       context: string,
       state: string
   }
   interface Reviews{
       user: {
           login: string
       },
       state: string
   }
   
// contains the installation id necessary to authenticate as an installation
mergeOnGreen.getLatestCommit = async function getLatestCommit(owner:string, repo: string, pr: number) {
    try {
    const data = await github.repos.listCommits({
        owner: owner, 
        repo: repo, 
        pull_number: pr, 
        per_page: 100,
        page: 1    
    })
    return (data.data[(data.data.length)-1].sha);
} catch(err) {
        return null;
    }
}

mergeOnGreen.getPR = async function getPR(owner: string, repo: string, pr: number) {
    const data = await github.pulls.get({
        owner: owner,
        repo: repo,
        pull_number: pr
    })

   return data.data;
}


mergeOnGreen.getMOGLabel = async function getMOGLabel(owner: string, repo: string, pr: number, labelName: string) {    
let isMOG = false;
try {
const labels = await github.issues.listLabelsOnIssue({
    owner: owner,
    repo: repo,
    issue_number: pr
})
const labelArray = labels.data;
if (labelArray) {
    for (let x = 0; x<labelArray.length; x++) {
        if(labelArray[x].name === labelName) {
            isMOG = true;
        } else {
            isMOG = false;
        }
    }
}
    return isMOG;
} catch(err) {
    return null;
} 
}


// async function getRepoContents() {
//     try{
//     const configFile = await github.repos.getContents({
//         owner: owner,
//         repo: repo,
//         path: //path
//     })
//     let buf = Buffer.from(configFile.data.content, 'base64');
//     let decodedString = buf.toString('utf-8');
//     return decodedString;
// }
//     catch(err) {
//         console.log(err);
//         return null;
//     }
// }

// async function transformRepoContents() {
//    const repoContents = await getRepoContents();
//    //do something to repoContents, return array of required tests
// }

mergeOnGreen.getRequiredChecks = function getRequiredChecks() {
const requiredStatusChecks = [      
'Kokoro - Test: Binary Compatibility']

return requiredStatusChecks;
}


mergeOnGreen.getStatusi = async function getStatusi(owner: string, repo: string, pr: number) {
const head_sha = await mergeOnGreen.getLatestCommit(owner, repo, pr);
console.log(head_sha);
try {
    const data = await github.repos.listStatusesForRef({
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

mergeOnGreen.getRuns = async function getRuns(owner: string, repo: string, pr: number) {
const head_sha = await mergeOnGreen.getLatestCommit(owner, repo, pr);
try {
    const check_runs = await github.checks.listForRef({
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

mergeOnGreen.checkForRequiredSC = function checkForRequiredSC(checkSuitesOrRuns: CheckRun[], check: string) {
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



mergeOnGreen.statusesForRef = async function statusesForRef(owner: string, repo: string, pr: number, labelName: string) {
      const head_sha = await mergeOnGreen.getLatestCommit(owner, repo, pr);
      const mogLabel = await mergeOnGreen.getMOGLabel(owner, repo, pr, labelName);
      const checkStatus = await mergeOnGreen.getStatusi(owner, repo, pr);
      const requiredChecks = mergeOnGreen.getRequiredChecks();
      let mergeable = true;
      //console.log(checkStatus);
       if (checkStatus != null && head_sha != null && requiredChecks != null && mogLabel != false && mogLabel != null) {
        for (let check of requiredChecks) {
            //since find function finds the value of the first element in the array, that will take care of the chronological order of the tests
            let checkCompleted = checkStatus.find((element: CheckStatus) => element.context === check)
            if(checkCompleted === undefined) {
                    //if we can't find it in the statuses, let's check under check runs
                    let checkRuns = await mergeOnGreen.getRuns(owner, repo, pr);
                    mergeable = mergeOnGreen.checkForRequiredSC(checkRuns, check);
                    if (!mergeable) {
                        return mergeable;     
                    }                  
            } else if(checkCompleted.state != 'success') {
                mergeable = false;
                return mergeable;
            } 
        }
    } else {
        mergeable = false;
        console.log(checkStatus);
        console.log(head_sha);
        console.log(requiredChecks);
        console.log(mogLabel);
        console.log('Either you have no statuses, no head sha, no required checks, or no MOG Label')
        return mergeable;
    }
    return mergeable;
}

mergeOnGreen.getReviewsCompleted = async function getReviewsCompleted(owner :string, repo: string, pr: number) {
try {    
    const reviewsCompleted = await github.pulls.listReviews({
    owner: owner,
    repo: repo,
    pull_number: pr
  })
  return reviewsCompleted.data;
} catch(err) {
    return null;
}
}

mergeOnGreen.getReviewsRequested = async function getReviewsRequested(owner :string, repo: string, pr: number) {
try {    
    const reviewsRequested = await github.pulls.listReviewRequests({
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
mergeOnGreen.cleanReviews = function cleanReviews(reviewsCompleted: Reviews[]) {
let cleanReviews = [];
let distinctReviewers: string[] = [];
for (let x=(reviewsCompleted.length)-1; x>=0; x--) {
    let reviewsCompletedUser = reviewsCompleted[x].user.login
    if(!(distinctReviewers.includes(reviewsCompletedUser))) {
        cleanReviews.push(reviewsCompleted[x]);
        distinctReviewers.push(reviewsCompletedUser);
    }
}
return cleanReviews;
}




mergeOnGreen.checkReviews = async function checkReviews(owner :string, repo: string, pr: number) {
let reviewsPassed = true;
  console.log('a');
    const reviewsCompletedDirty = await mergeOnGreen.getReviewsCompleted(owner, repo, pr);
    const reviewsRequested = await mergeOnGreen.getReviewsRequested(owner, repo, pr); 
    
    if (reviewsRequested!=null) {
        const reviewsCompleted = mergeOnGreen.cleanReviews(reviewsCompletedDirty);
    //console.log(reviewsCompleted);
        if (reviewsCompleted != null && reviewsCompleted.length != 0) {
            reviewsCompleted.forEach(review => {
                if (review.state != 'APPROVED'){
                    reviewsPassed = false;
                } 
            }) 
        }
    } 
        if (reviewsRequested != null && (reviewsRequested.users.length != 0 || reviewsRequested.teams.length != 0)) {
            reviewsPassed = false;
            return reviewsPassed;
        }
        console.log('a');
return reviewsPassed;  
}


mergeOnGreen.merge = async function merge(owner: string, repo: string, pr: number) {
const commitInfo = await mergeOnGreen.getPR(owner, repo, pr);
try {
const merge = await github.pulls.merge({
    owner: owner,
    repo: repo,
    pull_number: pr,
    commit_title: commitInfo.title,
    commit_message: commitInfo.body,
    merge_method: 'squash'
})
return merge;
} catch(err) {
    return null;
}
}



mergeOnGreen.createFailedParam = async function createFailedParam(owner: string, repo: string, pr: number) {
const head_sha = await mergeOnGreen.getLatestCommit(owner, repo, pr);
try {
const checkParams = github.checks.create({
    owner: owner,
    repo: repo,
    name: 'AutoMerge Failed', 
    head_sha: head_sha,
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
return checkParams;
} catch(err){
return null;
}
}

export async function mergeOnGreen(owner: string, repo: string, pr: number, labelName: string, state: string) {
    console.log('hi');
    let checkReview = await mergeOnGreen.checkReviews(owner, repo, pr);
    let checkStatus = await mergeOnGreen.statusesForRef(owner, repo, pr, labelName);
    if (checkReview === true && checkStatus === true && state === 'continue') {
        console.log('congrats!');
        mergeOnGreen.merge(owner, repo, pr);
        return true;
    } else if (state === 'stop'){
        mergeOnGreen.createFailedParam(owner, repo, pr);
        return true;
    } else {
        return false;
    }


//TODO: Fill in details on how to get config file
}