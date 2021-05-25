// Copyright 2021 Google LLC
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

import {v1 as SecretManagerV1} from '@google-cloud/secret-manager';
import {Octokit} from '@octokit/rest';

export const SECRET_NAME_FOR_COMMENT_PERMISSION = 'dpebot-public-repo';

export async function getAuthenticatedOctokit(
  projectId: String,
  secretName: String
): Promise<Octokit> {
  const secretsClient = new SecretManagerV1.SecretManagerServiceClient();
  const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
  const [version] = await secretsClient.accessSecretVersion({
    name,
  });

  const payload = version?.payload?.data?.toString() || '';
  if (payload === '') {
    throw Error('did not retrieve a payload from SecretManager.');
  }

  return new Octokit({auth: payload});
}
