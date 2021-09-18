import express, {Request, Response} from 'express';
import {GoogleAuth} from 'google-auth-library';
import {Helper} from './helper';
import {iam, iam_v1} from '@googleapis/iam';
import {SecretManagerServiceClient} from '@google-cloud/secret-manager';
export const app = express();

app.use(express.json());

async function getGoogleAuth() {
  return new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });
}

async function authenticateIAM(auth: GoogleAuth): Promise<iam_v1.Iam> {
  return await iam({
    version: 'v1',
    auth,
  });
}

async function authenticateSecretManager(
  auth: GoogleAuth
): Promise<SecretManagerServiceClient> {
  return new SecretManagerServiceClient({auth});
}

app.post('/', async (req: Request, res: Response) => {
  const serviceAccountProjectId = req.body.serviceAccountProjectId;
  const serviceAccountEmail = req.body.serviceAccountEmail;
  const secretManagerProjectId = req.body.secretManagerProjectId;
  const secretName = req.body.secretName;

  const googleAuth = await getGoogleAuth();
  const iamClient = await authenticateIAM(googleAuth);
  const secretManagerClient = await authenticateSecretManager(googleAuth);

  const helper = new Helper(
    iamClient,
    secretManagerClient,
    serviceAccountProjectId,
    serviceAccountEmail,
    secretManagerProjectId,
    secretName
  );

  await helper.rotateSecret(
    serviceAccountProjectId,
    serviceAccountEmail,
    secretManagerProjectId,
    secretName
  );

  res.sendStatus(200);
});
