// Copyright 2023 Google LLC
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

import util from 'util';
import {BigQuery} from '@google-cloud/bigquery';
import {GCFLogger, logger as defaultLogger} from 'gcf-utils';

const bigquery = new BigQuery();
const datasetId = 'RepoMetadata';
const tableId = 'RepoMetadata';

interface Metadata {
  api_service: string; // Format: bigquery.googleapis.com
  language: string;
  release_level: string;
  repository: string; // Format: googleapis/bigquery.
}

/**
 * Given metadata pulled from .repo-metadata and GitHub store
 * an entry in BigQuery calculating coverage.
 *
 * @param result The Policy Result for a single repository
 */
export async function storeMetadata(
  metadata: Metadata,
  logger: GCFLogger = defaultLogger
) {
  try {
    logger.info('storing repo metadata', metadata);
    await bigquery.dataset(datasetId).table(tableId).insert([metadata]);
  } catch (e) {
    // dumping the error like this is required because error objects from BigQuery
    // contain nested data, including insert errors in arrays.
    logger.error(util.inspect(e, false, null));
    throw e;
  }
}
