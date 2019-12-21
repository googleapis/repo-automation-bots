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

import { Application } from 'probot';
import { execSync } from 'child_process';
import fetch from 'node-fetch';
import * as tar from 'tar';
import * as uuid from 'uuid';
import { promises as fs } from 'fs';
import { resolve } from 'path';

const CONFIGURATION_FILE_PATH = 'publish.yml';

interface Configuration {}

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

      const secret: Secret = await handler.getPublicationSecrets(app);
      if (secret && secret.payload && secret.payload.data) {
        const publishConfig = handler.publishConfigFromSecret(secret as Secret);
        const npmRc = handler.generateNpmRc(publishConfig);
        handler.publish(npmRc, pkgPath, app);
      } else {
        app.log.error('could not load application secrets');
      }
    }
  });
}

handler.unpackPath = (): string => {
  return `/tmp/${uuid.v4()}`;
};

// secrets are stored in a key matching the bot's name:
const secretId = 'publish';
const project = process.env.PROJECT_ID;
handler.getPublicationSecrets = async (app: Application): Promise<Secret> => {
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
    const out = execSync(`npm publish --access=public`, {
      cwd: pkgPath,
    });
    app.log.info(out);
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
