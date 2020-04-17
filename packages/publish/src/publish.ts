// Copyright 2019 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

// define types for a few modules used by probot that do not have their
// own definitions published. Before taking this step, folks should first
// check whether type bindings are already published.

// eslint-disable-next-line node/no-extraneous-import
import {Application, Context} from 'probot';
import fetch from 'node-fetch';
import * as tar from 'tar';
import * as uuid from 'uuid';
// eslint-disable-next-line node/no-unsupported-features/node-builtins
import {promises as fs} from 'fs';
const {writeFile} = fs;
import {resolve} from 'path';

const CONFIGURATION_FILE_PATH = 'publish.yml';

interface Configuration {
  project?: string;
  secretId?: string;
}

interface PublishConfig {
  token: string;
  registry: string;
}

interface Secret {
  payload: {[key: string]: Buffer};
}

interface CandidateVersionInfo {
  version: string;
  name: string;
}

interface PublishOpts {
  npmRc: string;
  pkgPath: string;
  app: Application;
  prerelease?: boolean;
}

import {SecretManagerServiceClient} from '@google-cloud/secret-manager';
const sms = new SecretManagerServiceClient();

const PRE_RELEASE_TAG = 'next';
const PRE_RELEASE_LABEL = 'publish:candidate';

function handler(app: Application) {
  app.on('release.released', async context => {
    const repoName = context.payload.repository.name;
    const remoteConfiguration = (await context.config(
      CONFIGURATION_FILE_PATH
    )) as Configuration | null;

    // Skip publication unless it's explicitly enabled.
    if (!remoteConfiguration) {
      app.log.info(`publish not configured for (${repoName})`);
      return;
    }

    if (context.payload.release.tarball_url) {
      // Create a temporary directory to unpack release tarball to:
      const unpackPath = handler.unpackPath();
      app.log.info(`creating tmp directory ${unpackPath}`);
      await fs.mkdir(unpackPath, {
        recursive: true,
      });

      // Unpack the tarball to the directory we just created:
      await fetch(context.payload.release.tarball_url).then(res => {
        return new Promise((resolve, reject) => {
          const dest = tar.x({
            C: unpackPath,
          });
          dest.on('error', reject);
          dest.on('close', () => {
            app.log.info('finished unpacking tarball');
            return resolve();
          });
          res.body.pipe(dest);
        });
      });

      // The tarball most likely had an inner folder, which we traverse
      // into, before performing the publication step:
      const files = await fs.readdir(unpackPath, {
        withFileTypes: true,
      });
      let pkgPath = unpackPath;
      if (files.length === 1 && files[0].isDirectory()) {
        pkgPath = `${pkgPath}/${files[0].name}`;
      }

      const secret: Secret = await handler.getPublicationSecrets(
        app,
        remoteConfiguration
      );
      if (secret && secret.payload && secret.payload.data) {
        const publishConfig = handler.publishConfigFromSecret(secret);
        const npmRc = handler.generateNpmRc(publishConfig);
        await handler.publish({
          npmRc,
          pkgPath,
          app,
        });
        await removeLabels(context, app);
      } else {
        app.log.error('could not load application secrets');
      }
    }
  });

  app.on('pull_request.labeled', async context => {
    const repoName = context.payload.repository.name;
    const remoteConfiguration = (await context.config(
      CONFIGURATION_FILE_PATH
    )) as Configuration | null;

    // Skip publication unless it's explicitly enabled.
    if (!remoteConfiguration) {
      app.log.info(`publish not configured for (${repoName})`);
      return;
    }

    // if missing the label, skip
    if (
      !context.payload.pull_request.labels.some(
        label => label.name === PRE_RELEASE_LABEL
      )
    ) {
      app.log.info(
        `ignoring non-candidate label action (${context.payload.pull_request.labels.join(
          ', '
        )})`
      );
      return;
    }

    // We will publish a current snapshot of the repository:
    const name = context.payload.repository.name;
    const owner = context.payload.repository.owner.login;
    const tarballURL = `https://codeload.github.com/${owner}/${name}/legacy.tar.gz/master`;

    // Create a temporary directory to unpack release tarball to:
    const unpackPath = handler.unpackPath();
    app.log.info(`creating tmp directory ${unpackPath}`);
    await fs.mkdir(unpackPath, {
      recursive: true,
    });

    // Unpack the tarball to the directory we just created:
    await fetch(tarballURL).then(res => {
      return new Promise((resolve, reject) => {
        const dest = tar.x({
          C: unpackPath,
        });
        dest.on('error', reject);
        dest.on('close', () => {
          app.log.info('finished unpacking tarball');
          return resolve();
        });
        res.body.pipe(dest);
      });
    });

    // The tarball most likely had an inner folder, which we traverse
    // into, before performing the publication step:
    const files = await fs.readdir(unpackPath, {
      withFileTypes: true,
    });
    let pkgPath = unpackPath;
    if (files.length === 1 && files[0].isDirectory()) {
      pkgPath = `${pkgPath}/${files[0].name}`;
    }

    // Update the package.json on disk with a candidate version number, i.e.,
    // v3.0.0-beta.0:
    const candidateVersion = await setCandidateVersion(
      pkgPath,
      context.payload.pull_request.title
    );

    const secret: Secret = await handler.getPublicationSecrets(
      app,
      remoteConfiguration
    );
    if (secret && secret.payload && secret.payload.data) {
      // Create a pre-release on GitHub for this release candidate:
      await context.github.repos.createRelease({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        tag_name: `v${candidateVersion.version}`,
        name: `v${candidateVersion.version} Pre-release`,
        prerelease: true,
        target_commitish: 'master',
        body: `This is a pre-release for testing purposes of #${context.payload.pull_request.number}.\n\nInstall by running \`npm install ${candidateVersion.name}@${PRE_RELEASE_TAG}\``,
      });

      // Publish the package:
      const publishConfig = handler.publishConfigFromSecret(secret);
      const npmRc = handler.generateNpmRc(publishConfig);
      await handler.publish({npmRc, pkgPath, app, prerelease: true});

      // Remove label and comment:
      await context.github.issues.removeLabel({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        issue_number: context.payload.pull_request.number,
        name: PRE_RELEASE_LABEL,
      });
      await context.github.issues.createComment({
        owner,
        repo: repoName,
        issue_number: context.payload.pull_request.number,
        body: `A candidate release, \`${candidateVersion.version}\` was published to npm. Run \`npm install ${candidateVersion.name}@${PRE_RELEASE_TAG}\` to install.`,
      });
    } else {
      app.log.error('could not load application secrets');
    }
  });
}

async function setCandidateVersion(
  pkgPath: string,
  title: string
): Promise<CandidateVersionInfo> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pkgJson = require(`${pkgPath}/package.json`);
  const futureVersion = title.match(
    /release (?<version>[0-9]+\.[0-9]+\.[0-9]+$)/
  )?.groups?.version;
  if (!futureVersion) {
    throw Error('could not find version in pull request title');
  }
  const versions = await fetch(
    `https://registry.npmjs.org/${encodeURIComponent(pkgJson.name)}`
  )
    .then(res => {
      return res.json();
    })
    .then(body => {
      // "time" in an npm packument contains a history of all releases that
      // have ever happened:
      return Object.keys(body.time);
    });
  // Release the candidate release as v1.0.0-beta.(N) where N is equal to
  // the number of prior candidate releases. We determine whether there have
  // been prior candidate releases by looking at the "time" field
  // for a package:
  let counter = 0;
  let candidateVersion = `${futureVersion}-beta.${counter}`;
  for (;;) {
    if (!versions.includes(candidateVersion)) {
      break;
    } else {
      counter++;
      candidateVersion = `${futureVersion}-beta.${counter}`;
    }
  }
  pkgJson.version = candidateVersion;
  await writeFile(`${pkgPath}/package.json`, JSON.stringify(pkgJson), 'utf8');
  return {version: candidateVersion, name: pkgJson.name};
}

// Once the publication is complete, remove labels such as
// autorelease: pending, and autorelease: tagged, so that
// monitoring does not flag this as a failed release.
async function removeLabels(context: Context, app: Application) {
  const pulls = (
    await context.github.pulls.list({
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      state: 'closed',
      per_page: 100,
    })
  ).data;
  for (const pull of pulls) {
    if (pull.head.ref === `release-${context.payload.release.tag_name}`) {
      try {
        app.log.info(
          `attempting to remove labels for owner = ${context.payload.repository.owner.login} repo = ${context.payload.repository.name} number = ${pull.number}`
        );
        await context.github.issues.removeLabels({
          owner: context.payload.repository.owner.login,
          repo: context.payload.repository.name,
          issue_number: pull.number,
        });
      } catch (err) {
        app.log.error(err);
      }
    }
  }
}

handler.unpackPath = (): string => {
  return `/tmp/${uuid.v4()}`;
};

handler.getPublicationSecrets = async (
  app: Application,
  config: Configuration
): Promise<Secret> => {
  const secretId = config.secretId || 'publish';
  const project = config.project || process.env.PROJECT_ID;
  app.log.info(`looking up secret for ${project}`);
  const [secret] = await sms.accessSecretVersion({
    name: `projects/${project}/secrets/${secretId}/versions/latest`,
  });
  return secret as Secret;
};

handler.publishConfigFromSecret = (secret: Secret): PublishConfig => {
  const publishConfig: PublishConfig = JSON.parse(
    secret.payload.data.toString()
  );
  return publishConfig;
};

handler.publish = async (opts: PublishOpts) => {
  const {npmRc, pkgPath, app, prerelease} = opts;
  await fs.writeFile(resolve(pkgPath, './.npmrc'), npmRc, 'utf8');
  try {
    app.log.info(`installing ${pkgPath}`);
    // We make sure that ./node_modules/.bin is in the exec path.
    const npmPath = resolve(pkgPath, './node_modules/.bin');
    const PATH = process.env.PATH ? `${process.env.PATH}:${npmPath}}` : npmPath;
    await execAsync(
      'npm',
      ['i'],
      pkgPath,
      Object.assign({}, process.env, {
        PATH,
        // npm does install dev dependencies needed to publish
        // unless we override the NODE_ENV:
        NODE_ENV: 'development',
      })
    );
    try {
      // Prepare does not run as a side effect of `npm i`, due to
      // permission errors in cloud functions, so we run it
      // explicitly:
      app.log.info(`compiling ${pkgPath}`);
      await execAsync(
        'npm',
        ['run', 'prepare'],
        pkgPath,
        Object.assign({}, process.env, {
          PATH,
          NODE_ENV: 'development',
        })
      );
    } catch (err) {
      app.log.warn(err.message);
    }
    app.log.info(`publishing ${pkgPath}`);
    // If this is a prerelease, we publish to the "next" dist tag on npm:
    const publishOpts = ['publish', '--access=public'];
    if (prerelease) {
      publishOpts.push(`--tag=${PRE_RELEASE_TAG}`);
    }
    await execAsync(
      'npm',
      publishOpts,
      pkgPath,
      Object.assign({}, process.env, {
        PATH,
        NODE_ENV: 'development',
      })
    );
  } catch (err) {
    app.log.error(err);
  }
};

import {spawn} from 'child_process';
function execAsync(
  cmd: string,
  args: string[],
  cwd: string,
  env: {[key: string]: string | undefined}
) {
  return new Promise((resolve, reject) => {
    const subprocess = spawn(cmd, args, {
      env,
      cwd,
      stdio: 'inherit',
    });
    subprocess.on('close', () => {
      return resolve();
    });
    subprocess.on('error', err => {
      return reject(err);
    });
  });
}

handler.generateNpmRc = (publishConfig: PublishConfig): string => {
  const npmRc = `//${publishConfig.registry}/:_authToken=${publishConfig.token}
registry=https://${publishConfig.registry}/`;
  return npmRc;
};

export = handler;
