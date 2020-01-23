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



const oktokit = new Octokit({
    auth() {
      return "token "+process.env.SECRET_TOKEN;
    }
   });

// type Element = {
//     conclusion: string; 
//     name: string; 
//     status: string;
// }

async function getLatestCommit() {
    const data = await oktokit.checks.get({
        owner: 'sofisl', //this will be filled in by context of payload, i.e., context.payload.repository.owner.login
        repo: 'mergeOnGreenTest', //this will be filled in by context of payload, i.e., context.payload.repository.name
        check_run_id: '396210100' //what we're listening for
    })

    //console.log(data);

    // console.log("commit num: "+data.data.head_sha);
            return data.data.head_sha;
}

async function getPR() {
    const data = await oktokit.checks.get({
        owner: 'sofisl', //this will be filled in by context of payload, i.e., context.payload.repository.owner.login
        repo: 'mergeOnGreenTest', //this will be filled in by context of payload, i.e., context.payload.repository.name
        check_run_id: '396210100' //what we're listening for
    })

            return data.data.pull_requests[0].number;
}



async function checkRuns() {
          const head_sha = await getLatestCommit();
          const data = await oktokit.checks.listForRef({
              owner: 'sofisl',
              repo: 'mergeOnGreenTest',
              ref: '45a88ef9f356c30d211c08ced9524dbe76a14ee8'
            });
           const check_runs = data.data.check_runs;
           //console.log(check_runs);
           return check_runs;
        }
let testCount = 0;

async function checkStatusOfCheckRuns(testCount, callback) {    
        const check_runs_array = await checkRuns();
        let statusChecksDone = 'success';
        //create a branch that checks back if any status is not completed
        if (check_runs_array) {
            check_runs_array.forEach(element => {
                // console.log(element)
                if(element.conclusion != 'success') {
                    statusChecksDone = 'failed';
                    return statusChecksDone;
                }
                if(element.status != 'completed') {
                    testCount++;
                    if(testCount===0) {
                        console.log('still waiting on tests 1');
                        testCount++;
                        statusChecksDone = 'pending';
                        setTimeout(function() {checkStatusOfCheckRuns(testCount), function() {console.log('hello')}}, 600);   
                    } else if (testCount ===1) {
                        console.log('still waiting on tests 2');
                        testCount++;
                        statusChecksDone = 'pending';
                        setTimeout(function() {checkStatusOfCheckRuns(testCount), function() {console.log('hello')}}, 1800);
                    } else if (testCount ===2) {
                        console.log('still waiting on tests 3');
                        testCount++;
                        statusChecksDone = 'pending';
                        setTimeout(function() {checkStatusOfCheckRuns(testCount), function() {console.log('hello')}}, 300000);
                    } else if (testCount === 3|| testCount === 4) {
                        console.log('still waiting on tests 4');
                        testCount++;
                        statusChecksDone = 'pending';
                        setTimeout(function() {checkStatusOfCheckRuns(testCount), function() {console.log('hello')}}, 6000);
                    } else {
                        statusChecksDone = 'failed';
                    }
                 }        
                 
            })
        }
        callback(statusChecksDone);
        //return statusChecksDone;
        
    }   


    async function getRequiredReviews(reviewCount, callback) {
        let reviewsDone = 'success';
        const reviewsCompleted = await oktokit.pulls.listReviews({
        owner: 'sofisl',
        repo: 'mergeOnGreenTest',
        pull_number: 45
      })
       console.log("A ");
    //   console.log(reviewsCompleted);

      const reviewsRequested = await oktokit.pulls.listReviewRequests({
        owner: 'sofisl',
        repo: 'mergeOnGreenTest',
        pull_number: 45
      })
      console.log("B ");
    //   console.log(reviewsRequested);
    //   console.log('data');
    //   console.log(reviewsRequested.data);
      const reviewsCompletedArray = reviewsCompleted.data;
      const reviewsRequestedArrayUsers = reviewsRequested.data.users;
      const reviewsRequestedArrayTeams = reviewsRequested.data.teams;
    //   console.log(reviewsRequestedArrayTeams.length);
    //   console.log(reviewsRequestedArrayUsers.length);


    //   console.log("a "+reviewsCompleted);
    //  console.log("b "+reviewsRequested);
      if (reviewsCompletedArray) {
          console.log('c');
          reviewsCompletedArray.forEach(element => {
              console.log('e');
              if(element.state != 'APPROVED') { 
                console.log('d');
                  reviewsDone = 'failed';
              } 
          })
      }


      if ((reviewsRequestedArrayUsers.length !=0 || reviewsRequestedArrayTeams.length !=0) && reviewCount < 24) {
          console.log('f');
            reviewsDone = 'pending';    //check back every 2 hours
            reviewCount++;
            setTimeout(function() {getRequiredReviews(reviewCount, function() {console.log('hello')})}, 720)    
        } else if (reviewCount >= 24 ) {
            console.log('g');
            reviewsDone = 'failed';
        }

        console.log(reviewsDone);
        callback(reviewsDone);
       // return reviewsDone; 
    }





    async function getMOGLabel() {    
        let isMOG = false;
        const pr = await getPR();
        const labels = await oktokit.issues.listLabelsOnIssue({
            owner: 'sofisl',
            repo: 'mergeOnGreenTest',
            issue_number: pr
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
        console.log(isMOG);
        return isMOG;
    }  

    
    
    
    //let reviewCount = 0;
    // async function recursiveChecks() {  
    //     let reviewsPassed;
    //     let reviews = await getRequiredReviews(reviewCount);
    //     if (reviews === 'pending') {
    //         reviewCount++;
    //         setTimeout(function() {
    //             recursiveChecks() }, 720);
    //     } else {
    //         if (reviews === 'success') {
    //             reviewsPassed = true;
    //         } else {
    //             reviewsPassed = false;
    //         }
    //     }
    //     return reviewsPassed;
    // }

   function getStatusChecks(trivalue) {
        //reviewsPassed = await getRequiredReviews(reviewCount);
        // console.log(reviewsPassed);
        // console.log('start status checks');
        //checks = await checkStatusOfCheckRuns(testCount);
        //make sure to check that required status checks have passed
        
        if (triValue === 'success') {
            return true;
        } else if (triValue === 'failed') {
            return false;
        }
    }
    function getBoolean(firstValue, secondValue) {
        if (firstValue && secondValue) {
            console.log('pass check status');
        }
    }

getBoolean(getRequiredReviews(0, getStatusChecks), checkStatusOfCheckRuns(0, getStatusChecks))

    


    // function printMessage() {
    //     console.log("still waiting on reviews");
    // }

    
    //checkStatusOfCheckRuns();

//TODO: make sure we check for merge-on-green label before passing the test
//TODO: Write logic to check back if tests are not completed
//TODO: Check for required code reviews
//DECIDE: do we want to listen to PRs or check runs?
//TODO: console log 'would have merged' based on pass of status check