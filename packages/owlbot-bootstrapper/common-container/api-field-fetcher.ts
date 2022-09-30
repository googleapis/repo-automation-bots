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
import {ApiFields, DriftApi, GHDir, GHFile} from './interfaces';
import yaml from 'js-yaml';
import {getWellKnownFileContents, INTER_CONTAINER_VARS_FILE} from './utils';
import * as fs from 'fs';
/**
 * Fetches API-related information
 *
 * @param apiId the unique API ID
 * @param storageClient a new instance of Storage
 * @param octokit a new instance of Octokit
 */
export class ApiFieldFetcher {
  apiId: string;
  storageClient: Storage;
  octokit: Octokit;

  constructor(apiId: string, octokit: Octokit, storageClient: Storage) {
    this.apiId = apiId;
    this.octokit = octokit;
    this.storageClient = storageClient;
  }

  /**
   * Function that gets api information from a public DRIFT bucket, and saves it to a well-known location on disk
   * @param apiId the unique API ID
   * @param storageClient an instance of Google Cloud Storage
   * @returns DriftApi info
   */
  public async _getDriftMetadata(
    apiId: string,
    storageClient: Storage
  ): Promise<DriftApi> {
    const bucket = 'devrel-prod-settings';
    const file = 'apis.json';
    const contents = await storageClient.bucket(bucket)?.file(file)?.download();
    if (!contents) {
      throw new Error('apis.json downloaded from Cloud Storage was empty');
    }

    const apis = JSON.parse(contents.toString()).apis;
    return this._extractApiInfoFromJson(apis, apiId);
  }
  /**
   * Function that extracts information for a given API from apis.json
   *
   * @param apis the apis.json file downloaded from drift as a JSON object
   * @param apiId the unique identifier of the API
   * @returns DriftAPI the fields as described in Drift
   */
  public _extractApiInfoFromJson(apis: DriftApi[], apiId: string): DriftApi {
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
      launch_stage: '',
    };
  }

  private isFile(file: GHFile | GHDir[]): file is GHFile {
    return (file as GHFile).content !== undefined;
  }

  /**
   * Function that gets information from the apiName_versionNumber.yaml (api_proto.yaml) file in googleapis/googleapis
   *
   * @param octokit an instantiated Octokit instance
   * @param apiId the unique identifier of the API
   * @returns DriftAPI the fields as described in Drift
   */
  public async _getApiProtoInformation(
    octokit: Octokit,
    apiId: string
  ): Promise<{name: string | undefined; title: string | undefined}> {
    let path = apiId.toString().replace(/\./g, '/');

    const dir = (
      await octokit.rest.repos.getContent({
        owner: 'googleapis',
        repo: 'googleapis',
        path: `${path}`,
      })
    ).data as GHDir[];

    // GH does not support getting a path with a glob, so we must search through the directory to get the right name (since
    // not all yaml files follow the same naming conventions)
    for (const file of dir) {
      if (file.name.match(/_v.*?.yaml$/)) {
        path = `${path}/${file.name}`;
      }
    }

    const yamlFile = (
      await octokit.rest.repos.getContent({
        owner: 'googleapis',
        repo: 'googleapis',
        path,
      })
    ).data;

    let parsedYaml:
      | {name: string | undefined; title: string | undefined}
      | undefined;
    if (this.isFile(yamlFile as any)) {
      parsedYaml = yaml.load(
        Buffer.from((yamlFile as any).content, 'base64').toString('utf8')
      ) as {name: string | undefined; title: string | undefined};
    }

    return {name: parsedYaml?.name || '', title: parsedYaml?.title || ''};
  }

  /**
   * Compiles variables from DRIFT and Github into ApiFields object
   *
   * @param apiId the unique API ID
   * @param storageClient a new instance of Storage
   * @param octokit a new instance of Octokit
   * @returns ApiFields
   */
  public async _compileVariablesIntoApiFields(
    apiId: string,
    octokit: Octokit,
    storageClient: Storage
  ): Promise<ApiFields> {
    const driftData = await this._getDriftMetadata(apiId, storageClient);
    const apiProtoData = await this._getApiProtoInformation(octokit, apiId);

    return {
      apiShortName: driftData.api_shortname,
      apiPrettyName: apiProtoData.title || driftData.display_name,
      apiProductDocumentation: driftData.docs_root_url,
      apiReleaseLevel: driftData.launch_stage,
      apiId: apiProtoData.name,
    };
  }

  /**
   * Writes API-related variables to the interContainerVars.json file
   *
   * @param variables ApiFields
   * @param directoryPath local directory in which it is running
   */
  public async _writeVariablesToWellKnownLocation(
    variables: ApiFields,
    directoryPath: string
  ) {
    let contents = {};
    if (fs.existsSync(`${directoryPath}/${INTER_CONTAINER_VARS_FILE}`)) {
      contents = getWellKnownFileContents(
        directoryPath,
        INTER_CONTAINER_VARS_FILE
      );
    }

    Object.assign(contents, variables);
    fs.writeFileSync(
      `${directoryPath}/${INTER_CONTAINER_VARS_FILE}`,
      JSON.stringify(contents, null, 4)
    );
  }

  /**
   * Gets API-specific information from various sources, and saves it to a well-known location
   *
   */
  public async getAndSaveApiInformation(directoryPath: string) {
    const variables = await this._compileVariablesIntoApiFields(
      this.apiId,
      this.octokit,
      this.storageClient
    );
    this._writeVariablesToWellKnownLocation(variables, directoryPath);
  }
}
