// Copyright 2020 Google LLC
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
import {GCFLogger} from 'gcf-utils';

const PRODUCTS_FILE = 'products.json';
const SERVICE_CONFIG_PRODUCTS_FILE = 'service-config-products.json';

const storage = new Storage();

export interface ApiLabel {
  api_shortname: string; // run
  region_tag_prefix: string; // cloudrun
  title: string; // Cloud Run
  github_label: string; // api: run
}

export interface ApiLabels {
  products: Array<ApiLabel>;
}

/**
 * Helper to fetch the list of products from DRIFT's GCS bucket.
 *
 * @param {string} dataBucket Name of the GCS bucket
 * @param {GCFLogger} logger Context logger
 * @returns {ApiLables} Parsed product definitions
 */
export async function getDriftApiLabels(
  dataBucket: string,
  logger: GCFLogger
): Promise<ApiLabels> {
  const apis = await storage.bucket(dataBucket).file(PRODUCTS_FILE).download();
  const parsedResponse = JSON.parse(apis[0].toString()) as ApiLabels;
  logger.debug({apiLabels: parsedResponse});
  return parsedResponse;
}

/**
 * Helper function to merge multiple lists of products, de-duplicating by
 * region_tag_prefix.
 *
 * @param {ApiLabels[]} labels Lists of product definitions
 * @return {ApiLabel} Merged list of product definitions
 */
export function mergeApiLabels(...labels: ApiLabels[]): ApiLabels {
  const apisByPrefix = new Map<string, ApiLabel>();
  for (const apiLabels of labels) {
    for (const apiLabel of apiLabels.products) {
      if (!apisByPrefix.get(apiLabel.region_tag_prefix)) {
        apisByPrefix.set(apiLabel.region_tag_prefix, apiLabel);
      }
    }
  }

  return {
    products: Array(...apisByPrefix.values()),
  };
}

/**
 * Helper to fetch cached list of products from our cache bucket.
 *
 * @param {string} dataBucket Name of the GCS bucket
 * @param {GCFLogger} logger Context logger
 * @returns {ApiLables} Parsed product definitions
 */
export async function getApiLabels(
  dataBucket: string,
  logger: GCFLogger
): Promise<ApiLabels> {
  const apis = await storage
    .bucket(dataBucket)
    .file(SERVICE_CONFIG_PRODUCTS_FILE)
    .download();
  const parsedResponse = JSON.parse(apis[0].toString()) as ApiLabels;
  logger.debug({apiLabels: parsedResponse});
  return parsedResponse;
}

/**
 * Helper function to store a list of products into our cache bucket.
 *
 * @param {string} dataBucket Name of the GCS bucket
 * @param {GCFLogger} logger Context logger
 */
export async function setApiLabels(
  dataBucket: string,
  apiLabels: ApiLabels
): Promise<void> {
  const contents = JSON.stringify(apiLabels);
  await storage
    .bucket(dataBucket)
    .file(SERVICE_CONFIG_PRODUCTS_FILE)
    .save(contents);
}
