// Copyright 2022 Google LLC
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

// This file is kicked off by a manual CLI invocation, either by an event or by a human.
// It kicks off a trigger in cloud build.

import {CloudBuildClient} from '@google-cloud/cloudbuild';

export async function runTrigger(argv: any, cb: CloudBuildClient) {
  const [resp] = await cb.runBuildTrigger({
    projectId: argv.projectId,
    triggerId: argv.triggerId,
    source: {
      projectId: argv.projectId,
      branchName: 'main',
      substitutions: {
        _API_ID: argv.apiId,
        _REPO_TO_CLONE: argv.repoToClone,
        _IS_PRE_PROCESS: argv.isPreProcess,
        _LANGUAGE: argv.language,
        _INSTALLATION_ID: argv.installationId,
        _CONTAINER: argv.container,
        _LANGUAGE_CONTAINER: argv.languageContainer,
      },
    },
  });

  //   const buildId: string = (resp as any).metadata.build.id;
  await resp.promise();
}

// I'd like to keep the following commented code in case we need
// to wait for a Build
//   try {
//     await waitForBuild(argv.projectId, buildId, cb);
//     return;
//   } catch (e) {
//     const err = e as Error;
//     logger.error(err);
//     return;
//   }
// }

// // Repurposed from owl-bot/src/core.ts
// async function waitForBuild(
//   projectId: string,
//   id: string,
//   client: CloudBuildClient
// ) {
//   for (let i = 0; i < 60; i++) {
//     const [build] = await client.getBuild({projectId, id});
//     if (build.status !== 'WORKING' && build.status !== 'QUEUED') {
//       return build;
//     }
//     // Wait a few seconds before checking the build status again:
//     await new Promise(resolve => {
//       setTimeout(() => {
//         return resolve(undefined);
//       }, 10000);
//     });
//   }
//   throw Error(`timed out waiting for build ${id}`);
// }
