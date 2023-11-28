// Copyright 2020 Google LLC
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

import {logger} from 'gcf-utils';

// *** Helper functions for all types fo labels ***

export const CONFIG_FILE_NAME = 'auto-label.yaml';

// Default app configs if user didn't specify a .config
export const LABEL_PRODUCT_BY_DEFAULT = true;

// The max amount of days which can be configured for staleness
export const MAX_DAYS = 365;

// The default amount of days to be used to assume that pull request is stale
export const DEFAULT_DAYS_TO_STALE = 60;

// The default prefix for all stale labels
export const STALE_PREFIX = 'stale:';

// The default prefix for all pull request size labels
export const SIZE_PREFIX = 'size:';

// The label for old pull requests
export const OLD_LABEL = 'old';

// The label for extra old pull requests
export const EXTRAOLD_LABEL = 'extraold';

export const DEFAULT_CONFIGS = {
  product: LABEL_PRODUCT_BY_DEFAULT,
  language: {
    pullrequest: false,
  },
  path: {
    pullrequest: false,
  },
  staleness: {
    pullrequest: false,
  },
  requestsize: {
    enabled: false,
  },
};

/**
 * The list of all labels used to mark pull request size.
 * Given a fact that by default pull request size labeling feature is off,
 * we will update those labels in repo only when configuration is enabled
 * Currently there are following labels available:
 *   "size: u" for empty pull request.
 *   "size: xs" for pull request with less than 10 changes.
 *   "size: s" for pull request with less than 50 changes.
 *   "size: m" for pull request with less than 250 changes.
 *   "size: l" for pull request with less than 1000 changes.
 *   "size: xl" for pull request with 1000 or more changes.
 */
export const PULL_REQUEST_SIZE_LABELS = [
  {
    name: 'size: u',
    description: 'Pull request is empty.',
    color: 'a2ff00',
  },
  {
    name: 'size: xs',
    description: 'Pull request size is extra small.',
    color: '00ff4b',
  },
  {
    name: 'size: s',
    description: 'Pull request size is small.',
    color: '9cfa00',
  },
  {
    name: 'size: m',
    description: 'Pull request size is medium.',
    color: 'effa00',
  },
  {
    name: 'size: l',
    description: 'Pull request size is large.',
    color: 'ff7a00',
  },
  {
    name: 'size: xl',
    description: 'Pull request size is extra large.',
    color: 'c6040f',
  },
];

/**
 * Checks whether the intended label already exists
 */
export function labelExists(
  labels: Label[],
  new_labels: string | string[]
): Label[] | null {
  const returnLabels = [];
  for (const label of labels) {
    if (Array.isArray(new_labels)) {
      for (const new_label of new_labels) {
        if (label.name === new_label) {
          logger.info(`Exiting: label ${new_label} already exists`);
          returnLabels.push(label);
        }
      }
    } else {
      if (label.name === new_labels) {
        logger.info(`Exiting: label ${new_labels} already exists`);
        returnLabels.push(label);
      }
    }
  }
  return returnLabels.length ? returnLabels : null;
}

/**
 * Checks whether the intended label already exists by given prefix
 */
export function fetchLabelByPrefix(
  labels: Label[],
  label_prefix: string
): Label | null {
  if (!labels) {
    return null;
  }
  for (const label of labels) {
    if (label.name.startsWith(label_prefix)) {
      logger.info(
        `Exiting: label ${label.name} found by prefix ${label_prefix}`
      );
      return label;
    }
  }
  return null;
}

/**
 * Checks whether the given time is already expired (e.g. over given days limit)
 */
export function isExpiredByDays(time: string, limit: number) {
  const created_at = Date.parse(time);
  const diffInMs = Math.abs(Date.now() - created_at);
  const diffInDays = diffInMs / (1000 * 60 * 60 * 24);
  if (isNaN(diffInDays) || typeof diffInDays === 'undefined') return false;
  return diffInDays > limit;
}

/**
 * Checks whether the intended label already exists by given prefix
 */
export function getPullRequestSize(changes: number): string {
  if (changes <= 0) {
    return 'u';
  } else if (changes < 10) {
    return 'xs';
  } else if (changes < 50) {
    return 's';
  } else if (changes < 250) {
    return 'm';
  } else if (changes < 1000) {
    return 'l';
  }
  return 'xl';
}

// *** Helper functions for product type labels ***
export interface PathConfig {
  [index: string]: string | PathConfig;
}

export interface LanguageConfig {
  pullrequest?: boolean;
  labelprefix?: string;
  extensions?: {
    [index: string]: string[];
  };
  paths?: PathConfig;
  multipleLabelPaths?: LabelPrefixAndPaths[];
}

export interface LabelPrefixAndPaths {
  labelprefix?: string;
  extensions?: {
    [index: string]: string[];
  };
  paths?: PathConfig;
}

export interface StaleConfig {
  pullrequest?: boolean;
  old?: number;
  extraold?: number;
}

export interface PullRequestSizeConfig {
  enabled?: boolean;
}

export interface Config {
  enabled?: boolean;
  product?: boolean;
  path?: {
    pullrequest?: boolean;
    labelprefix?: string;
    paths?: PathConfig;
  };
  language?: LanguageConfig;
  staleness?: StaleConfig;
  requestsize?: PullRequestSizeConfig;
}

export interface Label {
  name: string;
}

export interface DriftApi {
  github_label: string;
}

export interface DriftRepo {
  github_label: string;
  repo: string;
}

/**
 * autoDetectLabel tries to detect the right api: label based on the issue
 * title. For example, an issue titled `spanner/transactions: TestSample failed`
 * would be labeled `api: spanner`.
 * @param apis
 * @param title
 */
export function autoDetectLabel(
  apis: DriftApi[] | null,
  title: string
): string | undefined {
  if (!apis || !title) {
    return undefined;
  }

  // Regex to match the scope of a Conventional Commit message.
  const conv = /[^(]+\(([^)]+)\):/;
  const match = title.match(conv);

  let firstPart = match ? match[1] : title;

  // Remove common prefixes. For example,
  // https://github.com/GoogleCloudPlatform/java-docs-samples/issues/3578
  const trimPrefixes = ['com.example.', 'com.google.', 'snippets.'];
  for (const prefix of trimPrefixes) {
    if (firstPart.startsWith(prefix)) {
      firstPart = firstPart.slice(prefix.length);
    }
  }

  if (firstPart.startsWith('/')) firstPart = firstPart.substr(1); // Remove leading /.
  firstPart = firstPart.split(':')[0]; // Before the colon, if there is one.
  firstPart = firstPart.split('/')[0]; // Before the slash, if there is one.
  firstPart = firstPart.split('.')[0]; // Before the period, if there is one.
  firstPart = firstPart.split('_')[0]; // Before the underscore, if there is one.
  firstPart = firstPart.toLowerCase(); // Convert to lower case.
  firstPart = firstPart.replace(/\s/, ''); // Remove spaces.
  firstPart = firstPart.replace('-', ''); // Remove dashes.

  // The Conventional Commits "docs" and "build" prefixes are far more common
  // than the APIs. So, never label those with "api: docs" or "api: build".
  if (firstPart === 'docs' || firstPart === 'build') {
    return undefined;
  }

  // Replace some known firstPart values with their API name.
  const commonConversions = new Map();
  commonConversions.set('video', 'videointelligence');
  commonConversions.set('spannertest', 'spanner');
  commonConversions.set('spansql', 'spanner');
  commonConversions.set('media', 'mediatranslation');
  firstPart = commonConversions.get(firstPart) || firstPart;

  // Some APIs have "cloud" before the name (e.g. cloudkms and cloudiot).
  const possibleLabels = [`api: ${firstPart}`, `api: cloud${firstPart}`];
  return apis.find(api => possibleLabels.indexOf(api.github_label) > -1)
    ?.github_label;
}

// *** Helper functions for language and path type labels ***

// A mapping of languages to their file extensions
import defaultExtensions from './extensions.json';

export function getLabelFromPathConfig(
  filename: string,
  config: PathConfig
): string {
  // If user specified labels for discrete paths
  const dirs = filename.split('/');
  let label = '';
  let exactMatch = false;

  // There are 3 possiblities for configuration file:
  // 1. There is an exact match of filename and configuration path.
  // In this case, set the label to that configuration. However, keep
  // searching through the rest of the configuration file to find if
  // there are any deeper matches.
  // 2. There is a nested array or object that may contain a deeper match.
  // If so, search recursively through that object.
  // 3. If an exact deeper match was never found, set the label as whatever is
  // listed for the whole directory, '.'
  for (const dir of dirs) {
    if (typeof config[dir] === 'string') {
      label = config[dir] as string;
      exactMatch = true;
      break;
    } else if (typeof config[dir] === 'object' || Array.isArray(config[dir])) {
      label = getLabelFromPathConfig(filename, config[dir] as PathConfig);
    } else if (config['.'] && !exactMatch) {
      label = config['.'] as string;
    }
  }

  return label;
}

/**
 *  getFileLabel
 *  @param filename
 *  Output: "[prefix]label" or "" if no matches were found
 *  For language labeling, if no user specified language labels are found
 *  it will default to language mappings in extensions.json
 */
function getFileLabel(
  filename: string,
  config: LanguageConfig,
  type: string
): string | string[] {
  let lang: string | string[];
  // Return a path based label, if user defined a path configuration
  if (config.paths) {
    lang = '';
    lang = getLabelFromPathConfig(filename, config.paths);
    if (lang) {
      if (config.labelprefix) {
        return config.labelprefix + lang;
      }
      return lang;
    }
  } else if (config.multipleLabelPaths) {
    lang = [];
    for (const prefix of config.multipleLabelPaths) {
      if (prefix.paths) {
        const label = getLabelFromPathConfig(filename, prefix.paths);
        if (label) {
          if (prefix.labelprefix) {
            lang.push(prefix.labelprefix + label);
          } else {
            lang.push(label);
          }
        }
      }
    }
    return lang;
  }

  // Default to extension.json mapping since user didn't configure this file ext
  if (type === 'language') {
    const extensionMap: {[index: string]: string[]} = config.extensions
      ? {...config.extensions, ...defaultExtensions}
      : defaultExtensions;
    const ext: string = filename.substring(filename.lastIndexOf('.') + 1);
    const lang = Object.keys(extensionMap).find(key => {
      return extensionMap[key].includes(ext);
    });
    if (!lang) {
      return '';
    }
    if (config.labelprefix) {
      return config.labelprefix + lang;
    }
    return lang;
  }
  return '';
}

/**
 * FileData
 * Extracting relevant data from each file changed from github.pulls.listFiles
 */
interface FileData {
  filename: string;
  changes: number;
}

/**
 * getLabel
 * Output: "[prefix]label"
 * Map reduces changes in files and its corresponding label
 * Returns the highest frequency language_label OR path_label
 */
export function getLabel(
  data: FileData[],
  config: LanguageConfig,
  type: string
): string[] | undefined {
  const counted: {[key: string]: number} = {};
  const countedArray: {[key: string]: number}[] = [];
  for (const file of data) {
    const label = getFileLabel(file.filename, config, type);
    if (typeof label === 'string') {
      if (!counted[label]) {
        counted[label] = file.changes;
      } else {
        counted[label] += file.changes;
      }
    } else if (Array.isArray(label) && label.length > 0) {
      for (const l of label) {
        if (!counted[l]) {
          counted[l] = file.changes;
        } else {
          counted[l] += file.changes;
        }
        countedArray.push(counted);
      }
    }
  }
  let label: string[] = [];
  if (countedArray.length) {
    // countedArray is an array of objects with different labels' frequency.
    // We need to find the highest frequency-occurring label within an object,
    // And then compare that highest-occuring label with the other highest-occurring
    // labels in the other objects. For example:
    // [{ 'api: recaptchaenterprise': 15, 'asset: flagship': 15 }]
    // [{ 'api: compute': 14, 'asset: another': 21 }]
    // In this case, we will select the second array, since its highest value label
    // is more than any frquency of any label in the other array
    let max = 0;
    for (const count of countedArray) {
      const maxValue = Object.values(count).reduce((a, b) => Math.max(a, b), 0);
      if (maxValue > max) {
        max = maxValue;
        label = Object.keys(count);
      }
    }
  } else {
    label = Object.keys(counted).sort((a, b) => {
      return counted[b] - counted[a];
    });
    label = [label[0]];
  }

  return label[0] ? label : undefined;
}
