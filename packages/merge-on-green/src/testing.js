const { App } = require("@octokit/app");
const Octokit = require("@octokit/rest");
const dotenv = require("dotenv")

const octokit = new Octokit({
    auth() {
        return "token "+process.env.SECRET_TOKEN;    
    }
   });

// let whileCount = 0;
// let value = 'pending';

// const example = setInterval(function aName() {
//             if (value == 'success') {
//                 console.log("logging "+value);
//                 clearInterval(interval);
//             } else if (whileCount == 4) {
//                 value = 'success';
//             } else {
//                 console.log(value);
//                 whileCount++;
//             }     
//     }, 5000);


// setTimeout(function() {console.log(value)}, 40000);
async function checkRuns() {
    const data = await octokit.checks.listForRef({
        owner: 'googleapis',
        repo: 'repo-automation-bots',
        ref: 'a9b9f071777ae0da8470cf93ca11a041eef20c20',
        per_page: 100
      });
      //console.log(data);
     const checkRuns = data.data.check_runs;
     //console.log(checkRuns);
        
     return checkRuns;
  }


  async function getCheckRunsinSuite() {
      const data = await octokit.checks.listForSuite({
          owner:'googleapis',
          repo:'repo-automation-bots',
          check_suite_id: '415676968',
          per_page: 100
      });
     console.log(data.data.check_runs)
   
     return data.data.check_runs;
  }

  async function getSuite() {
    const data = await octokit.checks.getSuite({
        owner:'googleapis',
        repo:'repo-automation-bots',
        check_suite_id: '415676968'
    });
   console.log(data);
    console.log(data.data.app.events);
   return data.data.check_runs;
}

let reviewsDone = 'success';
let reviewCount = 0;
async function branchProtection() {
    const data = await octokit.repos.getBranchProtection({
          owner: 'sofisl',
          repo: 'mergeOnGreenTest',
          branch: 'master',
        });
   console.log(data.data.required_status_checks.contexts);
   return data;
}

//branchProtection;

async function name() {
    const checks = await checkRuns();
    checks.forEach(element => {
        console.log(element.id);
        console.log(element.app.name);
        console.log(element.conclusion);
         })
};

        //getSuite();
       // name();
    //branchProtection();
        //getCheckRunsinSuite();
const reviewsInterval = setInterval(async function getRequiredReviews() {
    const reviewsCompleted = await octokit.pulls.listReviews({
    owner: 'sofisl',
    repo: 'mergeOnGreenTest',
    pull_number: 45
  })

  const reviewsRequested = await octokit.pulls.listReviewRequests({
    owner: 'sofisl',
    repo: 'mergeOnGreenTest',
    pull_number: 45
  })
 
  const reviewsCompletedArray = reviewsCompleted.data;
  const reviewsRequestedArrayUsers = reviewsRequested.data.users;
  const reviewsRequestedArrayTeams = reviewsRequested.data.teams;

  if (reviewsCompletedArray) {
      reviewsCompletedArray.forEach(element => {
          if(element.state != 'APPROVED') { 
              reviewsDone = 'failed';
              clearInterval(reviewsInterval);
          } 
      })
  }

  if ((reviewsRequestedArrayUsers.length !=0 || reviewsRequestedArrayTeams.length !=0) && reviewCount < 2) {
        reviewsDone = 'pending';    //check back every 2 hours
        reviewCount++;
    } else if (reviewCount = 2 ) {
        reviewsDone = 'failed';
        clearInterval(reviewsInterval);
    }


 console.log('reviewCount '+reviewCount);
}, 5000);

let statusChecksDone = 'success';
let testCount = 0;


const statusCheckIntervals = setInterval(async function checkStatusOfCheckRuns() {    
    const checkRunsArray = await checkRuns();  
    //create a branch that checks back if any status is not completed
    //console.log(checkRunsArray);
    if (checkRunsArray.length != 0 && testCount <5) {
        console.log('a');
        testCount++;
        checkRunsArray.forEach(element => {
            console.log(element.name);
            console.log(element.conclusion);
            console.log.apply(element.status);
            console.log('b');
            if(element.conclusion != 'success') {
                statusChecksDone = 'failed';
                console.log('c');
                clearInterval(statusCheckIntervals);
            }
            if(element.status != 'completed') {
                console.log('d');
                if(testCount<5) {
                    console.log('still waiting on tests');
                    console.log('e');
                    console.log(testCount);
                } else {
                    console.log('f');
                    statusChecksDone = 'failed';
                    clearInterval(statusCheckIntervals);
                }
             }        
             
        })
    } else {
        console.log('g');
        statusChecksDone = 'failed' //i.e., there were no required status checks;
        clearInterval(statusCheckIntervals);
    }
    console.log('h');
}, 5000); 

setTimeout(function() {console.log("reviews "+reviewsDone)}, 100000)
setTimeout(function() {console.log("status checks "+statusChecksDone)}, 100000);