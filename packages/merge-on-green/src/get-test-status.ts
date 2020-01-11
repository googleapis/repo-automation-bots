import { Application} from 'probot';
import { GitHubAPI } from 'probot/lib/github';
import {ChecksListForRefParams} from '@octokit/rest';

// async function getTests(github: GitHubAPI, owner: string, repo: string, ref: string) {
//     try {
//       const data = (await github.checks.listForRef({
//           owner: owner,
//           repo: repo,
//           ref: ref
//       })).data
//       return data;
//     } catch (err) {
//       return null;
//     }
//   }

// getTests()
  
