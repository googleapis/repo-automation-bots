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

import {Storage} from '@google-cloud/storage';
import {ServiceConfigYaml, DriftApi, ReleaseLevel} from './interfaces';
import yaml from 'js-yaml';
import {
  FileNotFoundError,
  RepositoryFileCache,
} from '@google-automations/git-file-utils';
import {logger} from 'gcf-utils';
export const BUCKET = 'devrel-prod-settings';
export const DRIFT_APIS_FILE = 'apis.json';
export const GOOGLEAPIS_DEFAULT_BRANCH = 'master';
/**
 * Function that gets api information from a public DRIFT bucket
 * @param apiId the unique API ID
 * @param storageClient an instance of Google Cloud Storage
 * @returns DriftApi info
 */
async function getDriftMetadata(
  apiId: string,
  storageClient: Storage,
  bucket: string,
  file: string
): Promise<DriftApi> {
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
    if (
      api.api_shortname === shortName ||
      api.api_shortname?.includes(`cloud${shortName}`)
    ) {
      return api;
    }
  }

  // If we don't find a match, return an empty object
  logger.info(
    `There was no match in apis.json for ${apiId}, shortname: ${shortName}`
  );
  return {
    api_shortname: shortName,
    display_name: '',
    docs_root_url: '',
    launch_stage: 'LAUNCH_STAGE_UNSPECIFIED' as ReleaseLevel,
    github_label: '',
  };
}

function transformApiIdToPath(apiId: string): string {
  return apiId.toString().replace(/\./g, '/');
}

/**
 * Function that gets information from the service_config.yaml file in googleapis/googleapis
 *
 * @param apiId unique identifier fo API ID
 * @param repositoryFileCache wrapper for getting repository contents from github (allows globbing)
 * @returns a yaml object
 */
async function getApiProtoInformation(
  apiPath: string,
  repositoryFileCache: RepositoryFileCache
): Promise<Partial<ServiceConfigYaml>> {
  let yamlFilePath;
  let yamlFile;
  try {
    yamlFilePath = (
      await repositoryFileCache.findFilesByGlob(
        '**/*_v*.yaml',
        GOOGLEAPIS_DEFAULT_BRANCH,
        apiPath
      )
    )[0];
  } catch (e) {
    if (e instanceof FileNotFoundError) {
      logger.warn('service_config.yaml path was not found');
    } else {
      // rethrow
      throw e;
    }
  }

  try {
    if (yamlFilePath) {
      yamlFile = await repositoryFileCache.getFileContents(
        yamlFilePath,
        GOOGLEAPIS_DEFAULT_BRANCH
      );
    } else {
      logger.warn('service_config.yaml path was not found');
    }
  } catch (e) {
    if (e instanceof FileNotFoundError) {
      logger.warn('service_config.yaml was not found');
    } else {
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
  serviceConfig: Partial<ServiceConfigYaml>,
  driftData: DriftApi
): ServiceConfigYaml {
  if (!serviceConfig.publishing) {
    serviceConfig.publishing = {
      api_short_name: driftData.api_shortname,
      github_label: driftData.github_label,
      documentation_uri: driftData.docs_root_url,
      launch_stage: driftData.launch_stage,
    };
  }

  if (!serviceConfig?.publishing?.api_short_name) {
    logger.info(
      `Service config did not contain api_short_name; replacing with DRIFT ${driftData.api_shortname}`
    );
    serviceConfig.publishing.api_short_name = driftData.api_shortname;
  }

  if (!serviceConfig?.publishing?.github_label) {
    logger.info(
      `Service config did not contain github_label; replacing with DRIFT ${driftData.github_label}`
    );
    serviceConfig.publishing.github_label = driftData.github_label;
  }

  if (!serviceConfig?.publishing.documentation_uri) {
    logger.info(
      `Service config did not contain documentation_uri; replacing with DRIFT ${driftData.docs_root_url}`
    );
    serviceConfig.publishing.documentation_uri = driftData.docs_root_url;
  }

  if (!serviceConfig?.publishing.launch_stage) {
    logger.info(
      `Service config did not contain launch_stage; replacing with DRIFT ${driftData.launch_stage}`
    );
    serviceConfig.publishing.launch_stage = driftData.launch_stage;
  }

  return serviceConfig as ServiceConfigYaml;
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
): Promise<ServiceConfigYaml> {
  const apiPath = transformApiIdToPath(apiId);
  const driftData = await getDriftMetadata(
    apiId,
    storageClient,
    BUCKET,
    DRIFT_APIS_FILE
  );
  let serviceConfig: Partial<ServiceConfigYaml> = {};

  // If the service_config.yaml is empty, malformed, etc., it should
  // not block the process of generating a library. Instead, it should
  // generate with DRIFT fields or empty fields.
  try {
    serviceConfig = await getApiProtoInformation(apiPath, repositoryFileCache);
  } catch (err) {
    if (
      (err as Error)
        .toString()
        .match(/Service config not valid yaml or undefined/)
    ) {
      logger.warn('No service config.yaml found');
    } else {
      throw err;
    }
  }

  return assignDriftValuesToServiceConfig(serviceConfig, driftData);
}
