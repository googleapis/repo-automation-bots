/**
 * Copyright 2019 Google LLC. All Rights Reserved.
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

// define types for a few modules used by probot that do not have their
// own definitions published. Before taking this step, folks should first
// check whether type bindings are already published.

import { Application, Context } from 'probot';
import { execSync } from 'child_process';
import fetch from 'node-fetch';
import * as tar from 'tar';
import * as uuid from 'uuid';
import { promises as fs } from 'fs';
import { resolve } from 'path';

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
  payload: { [key: string]: Buffer };
}

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
const sms = new SecretManagerServiceClient();

function handler(app: Application) {
  app.on('release.released', async context => {
    const repoName = context.payload.repository.name;
    const remoteConfiguration: Configuration | null = (await context.config(
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
        const publishConfig = handler.publishConfigFromSecret(secret as Secret);
        const npmRc = handler.generateNpmRc(publishConfig);
        await handler.publish(npmRc, pkgPath, app);
        await removeLabels(context);
      } else {
        app.log.error('could not load application secrets');
      }
    }
  });
}

// Once the publication is complete, remove labels such as
// autorelease: pending, and autorelease: tagged, so that
// monitoring does not flag this as a failed release.
async function removeLabels(context: Context) {
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
      await context.github.issues.removeLabels({
        owner: context.payload.repository.owner.login,
        repo: context.payload.repository.name,
        issue_number: pull.number,
      });
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
  app.log.info(`looking secret for ${project}`);
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

handler.publish = async (npmRc: string, pkgPath: string, app: Application) => {
  await fs.writeFile(resolve(pkgPath, './.npmrc'), npmRc, 'utf8');
  try {
    app.log.info(`installing ${pkgPath}`);
    // We make sure that ./node_modules/.bin is in the exec path.
    const npmPath = resolve(pkgPath, './node_modules/.bin');
    const PATH = process.env.PATH ? `${process.env.PATH}:${npmPath}}` : npmPath;
    let out = execSync(`npm i --`, {
      cwd: pkgPath,
      env: Object.assign({}, process.env, {
        PATH,
        // npm wil does install dev dependencies needed to publish
        // unless we override the NODE_ENV:
        NODE_ENV: 'development',
      }),
    });
    app.log.info(out.toString('utf8'));
    try {
      // Prepare does not run as a side effect of `npm i`, due to
      // permission errors in cloud functions, so we run it
      // explicitly:
      app.log.info(`compiling ${pkgPath}`);
      out = execSync(`npm run prepare`, {
        cwd: pkgPath,
        env: Object.assign({}, process.env, {
          PATH,
          NODE_ENV: 'development',
        }),
      });
      app.log.info(out.toString('utf8'));
    } catch (err) {
      app.log.warn(err.message);
    }
    app.log.info(`publishing ${pkgPath}`);
    out = execSync(`npm publish --access=public`, {
      cwd: pkgPath,
      env: Object.assign({}, process.env, {
        PATH,
        NODE_ENV: 'development',
      }),
    });
    app.log.info(out.toString('utf8'));
  } catch (err) {
    app.log.error(err);
  }
};

handler.generateNpmRc = (publishConfig: PublishConfig): string => {
  const npmRc = `//${publishConfig.registry}/:_authToken=${publishConfig.token}
registry=https://${publishConfig.registry}/`;
  return npmRc;
};

export = handler;
