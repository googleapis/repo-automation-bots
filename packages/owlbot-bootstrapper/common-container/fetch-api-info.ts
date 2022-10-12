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

import {Octokit} from '@octokit/rest';
import {Storage} from '@google-cloud/storage';
import {ServiceConfigYaml, DriftApi, ReleaseLevel} from './interfaces';
import yaml from 'js-yaml';
import {
  FileNotFoundError,
  RepositoryFileCache,
} from '@google-automations/git-file-utils';

/**
 * Function that gets api information from a public DRIFT bucket
 * @param apiId the unique API ID
 * @param storageClient an instance of Google Cloud Storage
 * @returns DriftApi info
 */
async function getDriftMetadata(
  apiId: string,
  storageClient: Storage
): Promise<DriftApi> {
  const bucket = 'devrel-prod-settings';
  const file = 'apis.json';
  const contents = await storageClient.bucket(bucket)?.file(file)?.download();
  let apis;
  if (contents) {
    apis = JSON.parse(contents.toString()).apis;
  }

  return extractApiInfoFromJson(apis, apiId);
}
/**
 * Function that extracts information for a given API from apis.json
 *
 * @param apis the apis.json file downloaded from drift as a JSON object
 * @param apiId the unique identifier of the API
 * @returns DriftAPI the fields as described in Drift
 */
function extractApiInfoFromJson(apis: DriftApi[], apiId: string): DriftApi {
  const shortName = apiId.split('.')[apiId.split('.').length - 2];
  for (const api of apis) {
    if (api.api_shortname?.includes(shortName)) {
      return api;
    }
  }

  return {
    api_shortname: shortName,
    display_name: '',
    docs_root_url: '',
    launch_stage: 'LAUNCH_STAGE_UNSPECIFIED' as ReleaseLevel,
    github_label: '',
  };
}

/**
 * Function that gets information from the service_config.yaml file in googleapis/googleapis
 *
 * @param apiId unique identifier fo API ID
 * @param repositoryFileCache wrapper for getting repository contents from github (allows globbing)
 * @returns a yaml object
 */
async function getApiProtoInformation(
  apiId: string,
  repositoryFileCache: RepositoryFileCache
): Promise<ServiceConfigYaml | any> {
  const path = apiId.toString().replace(/\./g, '/');

  let yamlFile;
  try {
    yamlFile = await repositoryFileCache.getFileContents(
      `${path}/.*?_v.*?.yaml$`,
      'main'
    );
  } catch (e) {
    if (e instanceof FileNotFoundError) {
      console.log('service_config.yaml was not found');
    } else {
      // rethrow
      throw e;
    }
  }

  let parsedYaml;
  if (yamlFile && yamlFile.parsedContent) {
    parsedYaml = yaml.load(yamlFile.parsedContent);
  }

  if (!parsedYaml) {
    throw new Error('Service config not valid yaml or undefined');
  }

  return parsedYaml;
}

function assignDriftValuesToServiceConfig(
  serviceConfig: ServiceConfigYaml,
  driftData: DriftApi
): ServiceConfigYaml {
  if (!serviceConfig?.api_short_name) {
    serviceConfig.api_short_name = driftData.api_shortname;
  }

  if (!serviceConfig?.github_label) {
    serviceConfig.github_label = driftData.github_label;
  }

  if (!serviceConfig?.documentation_uri) {
    serviceConfig.documentation_uri = driftData.docs_root_url;
  }

  if (!serviceConfig?.launch_stage) {
    serviceConfig.launch_stage = driftData.launch_stage;
  }

  return serviceConfig;
}

/**
 * Gets API-specific information from various sources
 * @param apiId the API ID of the API
 * @param storageClient for Google CLoud Storage
 * @param repositoryFileCache wrapper for getting repository contents from github
 * @returns ServiceConfigYaml obejct
 */
export async function loadApiFields(
  apiId: string,
  storageClient: Storage,
  repositoryFileCache: RepositoryFileCache
) {
  const driftData = await getDriftMetadata(apiId, storageClient);
  const serviceConfig = await getApiProtoInformation(
    apiId,
    repositoryFileCache
  );

  return assignDriftValuesToServiceConfig(serviceConfig, driftData);
}
