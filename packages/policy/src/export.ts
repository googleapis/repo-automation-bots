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

import {BigQuery, BigQueryDate} from '@google-cloud/bigquery';
import {PolicyResult} from './policy';

const bigquery = new BigQuery();
const datasetId = 'PolicyResults';
const tableId = 'PolicyResults';

interface BigQueryPolicyResult extends PolicyResult {
  recordDate: BigQueryDate;
}

/**
 * Given a single policy result, write the record to a BigQuery table.
 * This operates in an append-only fashion, writing a growing list
 * of results over time.
 * @param result The Policy Result for a single repository
 */
export async function exportToBigQuery(result: PolicyResult) {
  const r = result as BigQueryPolicyResult;
  r.recordDate = BigQuery.date(new Date().toISOString().slice(0, 10));
  await bigquery.dataset(datasetId).table(tableId).insert([r]);
}
