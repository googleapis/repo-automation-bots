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
 */
export const PULL_REUEST_SIZE_LABELS = [
  {
    name: 'size: xs',
    description: 'Pull request size is extra small.',
    color: '2deb01',
  },
  {
    name: 'size: s',
    description: 'Pull request size is small.',
    color: '2cc785',
  },
  {
    name: 'size: m',
    description: 'Pull request size is medium.',
    color: '5d743d',
  },
  {
    name: 'size: l',
    description: 'Pull request size is large.',
    color: 'd65692',
  },
  {
    name: 'size: xl',
    description: 'Pull request size is extra large.',
    color: '912925',
  },
  {
    name: 'size: xxl',
    description: 'Pull request size is extra extra large.',
    color: 'd22b5f',
  },
];

/**
 * Checks whether the intended label already exists
 */
export function labelExists(labels: Label[], new_label: string): Label | null {
  for (const label of labels) {
    if (label.name === new_label) {
      logger.info(`Exiting: label ${new_label} already exists`);
      return label;
    }
  }
  return null;
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
  if (changes >= 1500) {
    return 'xxl';
  } else if (changes >= 1250) {
    return 'xl';
  } else if (changes >= 1000) {
    return 'l';
  } else if (changes >= 250) {
    return 'm';
  } else if (changes >= 50) {
    return 's';
  }
  return 'xs';
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

function getLabelFromPathConfig(
  filename: string,
  config: LanguageConfig
): string {
  // If user specified labels for discrete paths
  let label: string | PathConfig = '';
  const dirs = filename.split('/');
  let paths = config.paths!;
  // If user set default label for entire drive, use that label
  if ('.' in paths) {
    label = paths['.'];
  }
  for (const dir of dirs) {
    if (dir in paths) {
      if ('.' in paths) label = paths['.'];
      if (typeof paths[dir] === 'string') {
        label = paths[dir];
        break; // break as this is the end of user defined path
      } else {
        paths = paths[dir] as PathConfig;
      }
    } else {
      break; // break as this is the end of user defined path
    }
  }
  return label as string;
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
): string {
  // Return a path based label, if user defined a path configuration
  if (config.paths) {
    const lang = getLabelFromPathConfig(filename, config);
    if (lang) {
      if (config.labelprefix) {
        return config.labelprefix + lang;
      }
      return lang;
    }
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
): string {
  const counts = data.reduce((counted: {[key: string]: number}, file) => {
    const l = getFileLabel(file.filename, config, type);
    if (l) {
      if (!counted[l]) {
        counted[l] = file.changes;
      } else {
        counted[l] += file.changes;
      }
    }
    return counted;
  }, {});

  const label = Object.keys(counts).sort((a, b) => {
    return counts[b] - counts[a];
  });
  logger.info('Detected labels based on files extensions are: ' + label);
  return label[0];
}
