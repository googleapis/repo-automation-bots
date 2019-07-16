import { createProbot, Probot, ApplicationFunction, Options, Application } from 'probot';
import { resolve } from 'probot/lib/resolver';
import { Storage } from '@google-cloud/storage';
import * as KMS from '@google-cloud/kms';
import { readFileSync } from 'fs';
import * as express from 'express';

let probot: Probot

async function loadProbot(appFn: ApplicationFunction): Promise<Probot> {
  if (!probot) {
    const cfg = await getProbotConfig();
    probot = createProbot(cfg);
  }

  if (typeof appFn === 'string') {
    appFn = resolve(appFn)
  }

  probot.load(appFn)

  return probot
}

async function getProbotConfig(): Promise<Options> {
  // Creates a client
  const storage = new Storage();

  const destFileName = "/tmp/creds.json";
  const bucketName = process.env.DRIFT_PRO_BUCKET || '';
  const srcFilename = process.env.GCF_SHORT_FUNCTION_NAME || '';

  const options = {
    // The path to which the file should be downloaded, e.g. "./file.txt"
    destination: destFileName,
  };

  // Downloads the file
  await storage.bucket(bucketName)
    .file(srcFilename)
    .download(options);

  const client = new KMS.KeyManagementServiceClient();
  const contentsBuffer = readFileSync(destFileName);
  const name = client.cryptoKeyPath(
    process.env.PROJECT_ID || '',
    process.env.KEY_LOCATION || '',
    process.env.KEY_RING || '',
    process.env.GCF_SHORT_FUNCTION_NAME || ''
  );

  const ciphertext = contentsBuffer.toString('base64');

  // Decrypts the file using the specified crypto key
  const [result] = await client.decrypt({ name, ciphertext });

  const config = JSON.parse(result.plaintext.toString());
  return config
}


export ={
  loadProbot,
  gcf: async (appFn: ApplicationFunction) => {
    return async (request: express.Request, response: express.Response) => {
      // Otherwise let's listen handle the payload
      probot = probot || await loadProbot(appFn);

      // Determine incoming webhook event type
      const name = request.get('x-github-event') || request.get('X-GitHub-Event');
      const id = request.get('x-github-delivery') || request.get('X-GitHub-Delivery') || '';

      // Do the thing
      if (name) {
        try {
          await probot.receive({
            name,
            id,
            payload: request.body
          })
          response.send({
            statusCode: 200,
            body: JSON.stringify({ message: 'Executed' })
          })
        } catch (err) {
          console.error(err)
          response.send({
            statusCode: 500,
            body: JSON.stringify({ message: err })
          })
        }
      } else {
        console.error(request)
        response.sendStatus(400)
      }
    }
  }
}