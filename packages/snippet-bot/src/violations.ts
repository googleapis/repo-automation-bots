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

import {getApiLabels} from './api-labels';
import {ApiLabel} from './api-labels';
import {ChangesInPullRequest} from './region-tag-parser';
import {Change} from './region-tag-parser';
import {Configuration} from './configuration';

type violationTypes = 'PRODUCT_PREFIX';

export interface Violation {
  change: Change;
  violationType: violationTypes;
}

const dataBucket = process.env.DEVREL_SETTINGS_BUCKET || 'devrel-prod-settings';

export const checkProductPrefixViolations = async (
  changes: ChangesInPullRequest,
  config: Configuration
): Promise<Array<Violation>> => {
  const ret: Violation[] = [];
  const apiLabels = await getApiLabels(dataBucket as string);
  for (const change of changes.changes) {
    if (change.type !== 'add') {
      continue;
    }
    if (config.ignoredFile(change.file as string)) {
      continue;
    }
    if (
      !apiLabels.products.some((label: ApiLabel) => {
        return change.regionTag.startsWith(label.region_tag_prefix);
      })
    ) {
      ret.push({
        change: change,
        violationType: 'PRODUCT_PREFIX',
      });
    }
  }
  return ret;
};
