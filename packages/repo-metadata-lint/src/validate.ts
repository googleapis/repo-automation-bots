// Copyright 2021 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

import Ajv from 'ajv';
import schema from './repo-metadata-schema.json';
import {Storage} from '@google-cloud/storage';
import {GCFLogger, logger as defaultLogger} from 'gcf-utils';

const storage = new Storage();

export interface ValidationResult {
  status: 'success' | 'error';
  errors: Array<string>;
}

// Types of libraries that should include api_shortname in .repo-metadata.json.
const API_LIBRARY_TYPES = [
  'GAPIC_AUTO',
  'GAPIC_MANUAL',
  'AGENT',
  'GAPIC_COMBO',
];

// Apply validation logic to .repo-metadata.json.
export class Validate {
  allowedApiShortnames: Set<string>;
  constructor(allowedApiShortnames: Set<string>) {
    this.allowedApiShortnames = allowedApiShortnames;
  }
  static async build(
    dataBucket: string,
    logger: GCFLogger = defaultLogger
  ): Promise<Validate> {
    const allowedApiShortnames = new Set<string>();
    const serviceConfigProducts = await getServiceConfigProducts(
      dataBucket,
      logger
    );
    for (const product of serviceConfigProducts.products) {
      allowedApiShortnames.add(product.api_shortname);
    }
    return new Validate(allowedApiShortnames);
  }
  async validate(path: string, repoMetadataContent: string) {
    const ajv = new Ajv({
      allErrors: true,
    });
    const validate = ajv.compile(schema);
    const result: ValidationResult = {status: 'success', errors: []};

    // Parse JSON content.
    try {
      JSON.parse(repoMetadataContent);
    } catch (err) {
      result.status = 'error';
      result.errors.push(`could not parse ${path}`);
      return result;
    }
    const repoMetadata = JSON.parse(repoMetadataContent);

    // Perform simple validation using JSON schema.
    const valid = validate(repoMetadata);
    if (valid === false) {
      result.status = 'error';
      for (const error of validate.errors || []) {
        result.errors.push(
          `${
            error.instancePath
              ? error.instancePath.replace(/^\/(.*)/, '$1 ')
              : ''
          }${error.message} in ${path}`
        );
      }
    }

    // Conditionally validate api_shortname for GAPIC libraries:
    if (API_LIBRARY_TYPES.includes(repoMetadata.library_type)) {
      if (!repoMetadata.api_shortname) {
        result.status = 'error';
        result.errors.push(`api_shortname field missing from ${path}`);
      } else {
        if (!this.allowedApiShortnames.has(repoMetadata.api_shortname)) {
          result.status = 'error';
          result.errors.push(
            `api_shortname '${repoMetadata.api_shortname}' invalid in ${path}`
          );
        }
      }
    }

    return result;
  }
}

interface ServiceConfigProducts {
  products: {
    api_shortname: string; // run
    // This file includes other unnecessary data:
    // region_tag_prefix: string; // cloudrun
    // title: string; // Cloud Run
    // github_label: string; // api: run
  }[];
}

/**
 * Helper to fetch cached list of products from our cache bucket.
 *
 * @param {string} dataBucket Name of the GCS bucket
 * @param {GCFLogger} logger Context logger
 * @returns {ApiLables} Parsed product definitions
 */
async function getServiceConfigProducts(
  dataBucket: string,
  logger: GCFLogger
): Promise<ServiceConfigProducts> {
  const apis = await storage
    .bucket(dataBucket)
    .file('service-config-products.json')
    .download();
  const parsedResponse = JSON.parse(
    apis[0].toString()
  ) as ServiceConfigProducts;
  logger.debug({apiLabels: parsedResponse});
  return parsedResponse;
}
