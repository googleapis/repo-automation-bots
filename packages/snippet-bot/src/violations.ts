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

import {ApiLabel, getApiLabels} from './api-labels';
import {Configuration} from './configuration';
import {
  ChangesInPullRequest,
  ParseResult,
  RegionTagLocation,
} from './region-tag-parser';
import {getSnippets} from './snippets';

type violationTypes =
  | 'PRODUCT_PREFIX'
  | 'REMOVE_USED_TAG'
  | 'REMOVE_CONFLICTING_TAG'
  | 'REMOVE_SAMPLE_BROWSER_PAGE'
  | 'TAG_ALREADY_STARTED'
  | 'NO_MATCHING_START_TAG'
  | 'NO_MATCHING_END_TAG';

export interface Violation {
  location: RegionTagLocation;
  violationType: violationTypes;
  devsite_urls: string[];
}

const dataBucket = process.env.DEVREL_SETTINGS_BUCKET || 'devrel-prod-settings';

export const checkRemovingUsedTagViolations = async (
  changes: ChangesInPullRequest,
  config: Configuration,
  parseResults: Map<string, ParseResult>,
  baseRepositoryPath: string, // googleapis/java-accessapproval
  baseBranch: string
): Promise<Map<string, Array<Violation>>> => {
  const removeUsedTagViolations = new Array<Violation>();
  const removeConflictingTagViolations = new Array<Violation>();
  const removeSampleBrowserViolations = new Array<Violation>();
  const snippets = await getSnippets(dataBucket);
  for (const change of changes.changes) {
    if (change.type !== 'del') {
      continue;
    }
    if (config.ignoredFile(change.file as string)) {
      continue;
    }
    const parseResult = parseResults.get(change.file as string);
    if (
      parseResult !== undefined &&
      parseResult.startTags.includes(change.regionTag)
    ) {
      // This region tag is deleted in the PR, but the same file has
      // the same region tag after the PR gets merged. Likely the PR author is
      // deleting redundunt region tags in this file. We can ignore
      // this case.
      continue;
    }
    const snippet = snippets[change.regionTag];
    if (snippet === undefined) {
      continue;
    }
    for (const k of Object.keys(snippet.languages)) {
      const lang = snippet.languages[k];
      let currentUrls: string[] = [];
      let sampleBrowserUrls: string[] = [];
      for (const loc of lang.current_locations) {
        if (
          loc.branch === baseBranch &&
          loc.repository_path === baseRepositoryPath &&
          loc.filename === change.file
        ) {
          if (loc.devsite_urls !== undefined && loc.devsite_urls.length > 0) {
            currentUrls = currentUrls.concat(loc.devsite_urls);
          }
          if (
            loc.sample_browser_urls !== undefined &&
            loc.sample_browser_urls.length > 0
          ) {
            sampleBrowserUrls = sampleBrowserUrls.concat(
              loc.sample_browser_urls
            );
          }
        }
        if (currentUrls.length > 0) {
          let violation: Violation;
          // Dispatch the violation depending on the current status.
          if (lang.status === 'IMPLEMENTED') {
            violation = {
              location: change,
              violationType: 'REMOVE_USED_TAG',
              devsite_urls: currentUrls,
            };
            removeUsedTagViolations.push(violation);
          } else if (lang.status === 'CONFLICT') {
            violation = {
              location: change,
              violationType: 'REMOVE_CONFLICTING_TAG',
              devsite_urls: currentUrls,
            };
            removeConflictingTagViolations.push(violation);
          }
        }
        if (sampleBrowserUrls.length > 0) {
          removeSampleBrowserViolations.push({
            location: change,
            violationType: 'REMOVE_SAMPLE_BROWSER_PAGE',
            devsite_urls: sampleBrowserUrls,
          });
        }
      }
    }
  }
  const ret: Map<string, Array<Violation>> = new Map([
    ['REMOVE_USED_TAG', removeUsedTagViolations],
    ['REMOVE_CONFLICTING_TAG', removeConflictingTagViolations],
    ['REMOVE_SAMPLE_BROWSER_PAGE', removeSampleBrowserViolations],
  ]);
  return ret;
};

export const checkProductPrefixViolations = async (
  changes: ChangesInPullRequest,
  config: Configuration
): Promise<Array<Violation>> => {
  const ret: Violation[] = [];
  const apiLabels = await getApiLabels(dataBucket);
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
        location: change,
        violationType: 'PRODUCT_PREFIX',
        devsite_urls: [],
      });
    }
  }
  return ret;
};
