// Copyright 2024 Google LLC
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

import {
  octokitFactoryFromToken,
  OctokitFactory,
  octokitFactoryFrom,
} from '../../octokit-util';
import {parseBotSecrets} from '../../bot-secrets';

interface Args {
  'github-token'?: string;
  installation: number;
}

export async function octokitFactoryFromArgsOrEnvironment(
  args: Args
): Promise<OctokitFactory> {
  return args['github-token']
    ? octokitFactoryFromToken(args['github-token'])
    : await octokitFactoryFromEnvironment(args.installation);
}

export async function octokitFactoryFromEnvironment(
  installation: number
): Promise<OctokitFactory> {
  const secretsJson = process.env.OWLBOT_SECRETS ?? '';
  const secrets = parseBotSecrets(secretsJson);
  return await octokitFactoryFrom({
    installation: installation,
    'app-id': secrets.appId,
    privateKey: secrets.privateKey,
  });
}
