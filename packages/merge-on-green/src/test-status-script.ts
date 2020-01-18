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

const Oktokit = require("@octokit/rest");

const oktokit = Oktokit({
    auth: '84a41c2e303ea1b027e7564b376d00b6b5731451',
    userAgent: 'sofisl',
    log: {
        debug: () => {},
        info: () => {},
        warn: console.warn,
        error: console.error
      },
    
      request: {
        agent: undefined,
        fetch: undefined,
        timeout: 0
      }
    })


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



async function checkRuns() {
          const head_sha = await getLatestCommit();
          const data = await oktokit.checks.listForRef({
              owner: 'sofisl',
              repo: 'mergeOnGreenTest',
              ref: head_sha
            });
           const check_runs = data.data.check_runs;
           //console.log(check_runs);
           return check_runs;
        }

async function checkStatusOfCheckRuns() {    
        const check_runs_array = await checkRuns();
        //create a branch that checks back if any status is not completed
        if (check_runs_array) {
            check_runs_array.forEach(element => {
                //console.log(element)
                    if(element.conclusion != 'success') {
                        console.log(element.name+' failed their test');
                }
                if(element.status != 'completed') {
                    console.log(element.name+' has not completed');
                    //check back in some way
                 }   
            })
        }

    }   

    checkStatusOfCheckRuns();


