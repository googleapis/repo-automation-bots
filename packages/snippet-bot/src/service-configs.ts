// Copyright 2023 Google LLC
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

/* eslint-disable-next-line node/no-extraneous-import */
import {Octokit} from '@octokit/rest';
import {RepositoryFileCache} from '@google-automations/git-file-utils';
import yaml from 'js-yaml';
import {ApiLabels, ApiLabel} from './api-labels';
import {GCFLogger, logger as defaultLogger} from 'gcf-utils';

interface ServiceConfig {
  type: string;
  config_version: number;
  name: string;
  title: string;
  publishing?: {
    organization: string;
    api_short_name: string;
    github_label: string;
    doc_tag_prefix: string;
  };
}

interface ScanLabelsOptions {
  branch?: string;
  logger?: GCFLogger;
}
export const scanServiceConfigsForApiLabels = async (
  octokit: Octokit,
  options: ScanLabelsOptions = {}
): Promise<ApiLabels> => {
  const branch = options?.branch ?? 'master';
  const logger = options?.logger ?? defaultLogger;
  const fileCache = new RepositoryFileCache(octokit, {
    owner: 'googleapis',
    repo: 'googleapis',
  });
  const apisByPrefix = new Map<string, ApiLabel>();
  const serviceConfigs = await fileCache.findFilesByGlob(
    '**/*_v*.yaml',
    branch
  );
  for (const serviceConfig of serviceConfigs) {
    const file = await fileCache.getFileContents(serviceConfig, branch);
    const content = yaml.load(file.parsedContent) as ServiceConfig;
    if (content.type !== 'google.api.Service') {
      logger.debug(`${serviceConfig} is not a service config file.`);
      continue;
    }
    if (!content.publishing) {
      logger.debug(`${serviceConfig} does not contain publishing info.`);
      continue;
    }
    if (!content.publishing.doc_tag_prefix) {
      logger.debug(
        `${serviceConfig} ${content.title} does not have a doc_tag_prefix.`
      );
      continue;
    }
    logger.info(`Found ${serviceConfig}: ${content.publishing.doc_tag_prefix}`);
    apisByPrefix.set(content.publishing.doc_tag_prefix, {
      api_shortname: content.publishing.api_short_name,
      region_tag_prefix: content.publishing.doc_tag_prefix,
      title: content.title,
      github_label: content.publishing.github_label,
    });
  }
  return {
    products: Array(...apisByPrefix.values()),
  };
};
