// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const {request} = require('gaxios');
const args = process.argv.slice(2);
const requiredJobs = JSON.parse(args[0]);
const runId = process.env.GITHUB_RUN_ID;
const repo = process.env.GITHUB_REPOSITORY;
const githubToken = args[1];

async function main() {
  // Do not wait longer than 20 minutes for all jobs to finish.
  // This loop goes 5 seconds at a time.
  // 20 minutes * 60 seconds/min / 5 seconds per loop.
  const iterations = 20 * 60 / 5
  for (let i=0; i<iterations; i++) {
    const url = `https://api.github.com/repos/${repo}/actions/runs/${runId}/jobs`;
    const res = await request({
      url,
      headers: {
        authentication: `token ${githubToken}`,
      }
    });
    for (const job of res.data.jobs) {
      if (job.status === 'completed' && job.conclusion !== 'success') {
        throw new Error(`Job ${job.name} failed.`);
      }
    }
    const totalCount = res.data.total_count;
    console.log(`total count: ${totalCount}`);
    console.log(`required jobs: ${requiredJobs.length}`);
    for (const job of requiredJobs) {
      console.log(`- ${job}`);
    }
    if (totalCount >= requiredJobs.length) {
      const successfulJobs = res.data.jobs.filter(job => {
        return job.status === 'completed' && job.conclusion === 'success';
      }).map(job => job.name);
      let completedCount = 0;
      for (const job of requiredJobs) {
        if (successfulJobs.includes(job)) {
          completedCount++;
        }
      }
      console.log(`${completedCount} of ${requiredJobs.length} required jobs complete.`);
      if (completedCount === requiredJobs.length) {
        return;
      }
    }
    await new Promise(r => setTimeout(r, 5000));
  }
}
main().catch(err => {
  console.log(`::error ${err.message}`);
  console.error(err);
  process.exitCode = -1;
});
