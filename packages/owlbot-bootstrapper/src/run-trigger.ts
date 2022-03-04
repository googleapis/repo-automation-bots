#!/usr/bin/env node

import {CloudBuildClient} from '@google-cloud/cloudbuild';
import {logger} from 'gcf-utils';
import yargs from 'yargs';

async function runTrigger(argv: any) {
  const cb = new CloudBuildClient();
  const [resp] = await cb.runBuildTrigger({
    projectId: argv.projectId,
    triggerId: argv.triggerId,
    source: {
      projectId: argv.projectId,
      branchName: 'master',
      substitutions: {
        _API_ID: argv.apiId,
        _REPO_TO_CLONE: argv.repoToClone,
        _IS_PRE_PROCESS: argv.isPreProcess,
        _LANGUAGE: argv.language,
        _INSTALLATION_ID: argv.installationId,
      },
    },
  });

  const buildId: string = (resp as any).metadata.build.id;

  try {
    await waitForBuild(argv.projectId, buildId, cb);
    return;
  } catch (e) {
    const err = e as Error;
    logger.error(err);
    return;
  }
}

// Repurposed from owl-bot/src/core.ts
async function waitForBuild(
  projectId: string,
  id: string,
  client: CloudBuildClient
) {
  for (let i = 0; i < 60; i++) {
    const [build] = await client.getBuild({projectId, id});
    if (build.status !== 'WORKING' && build.status !== 'QUEUED') {
      return build;
    }
    // Wait a few seconds before checking the build status again:
    await new Promise(resolve => {
      setTimeout(() => {
        return resolve(undefined);
      }, 10000);
    });
  }
  throw Error(`timed out waiting for build ${id}`);
}

const argv = yargs(process.argv.slice(2))
  .command('run-trigger', 'Runs the trigger')
  .options({
    projectId: {type: 'string', demandOption: true},
    triggerId: {type: 'string', demandOption: true},
    apiId: {type: 'string', demandOption: true},
    repoToClone: {type: 'string', demandOption: true},
    isPreProcess: {type: 'string', demandOption: true},
    language: {type: 'string', demandOption: true},
    installationId: {type: 'string', demandOption: true}
  }).argv;

async function main() {
  await runTrigger(argv);
}
main();
