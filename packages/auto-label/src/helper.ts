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

// eslint-disable-next-line node/no-extraneous-import
import {Context} from 'probot';
import {logger} from 'gcf-utils';
import {DriftApi, LanguageConfig, PathConfig} from './auto-label';

// Helper functions for product based labels

// autoDetectLabel tries to detect the right api: label based on the issue
// title.
//
// For example, an issue titled `spanner/transactions: TestSample failed` would
// be labeled `api: spanner`.
export function autoDetectLabel(
    apis: DriftApi[] | null,
    title: string
): string | undefined {
  if (!apis || !title) {
    return undefined;
  }

  // The Conventional Commits "docs:" and "build:" prefixes are far more common
  // than the APIs. So, never label those with "api: docs" or "api: build".
  if (title.startsWith('docs:') || title.startsWith('build:')) {
    return undefined;
  }

  // Regex to match the scope of a Conventional Commit message.
  const conv = /[^(]+\(([^)]+)\):/;
  const match = title.match(conv);

  let firstPart = match ? match[1] : title;

  // Remove common prefixes. For example,
  // https://github.com/GoogleCloudPlatform/java-docs-samples/issues/3578.
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

  // Replace some known firstPart values with their API name.
  const commonConversions = new Map();
  commonConversions.set('video', 'videointelligence');
  firstPart = commonConversions.get(firstPart) || firstPart;

  // Some APIs have "cloud" before the name (e.g. cloudkms and cloudiot).
  const possibleLabels = [`api: ${firstPart}`, `api: cloud${firstPart}`];
  return apis.find(api => possibleLabels.indexOf(api.github_label) > -1)
      ?.github_label;
}

// Helper functions for language and path based labels

// A mapping of languages to their file extensions
import defaultExtensions from './extensions.json';

/**
 * Checks whether the intended label already exists
 */
export function labelExists(context: Context, new_label: string): boolean {
  const labels = context.payload.issue
    ? context.payload.issue.labels
    : context.payload.pull_request.labels;
  for (const label of labels) {
    if (label.name === new_label) {
      logger.info(`Exiting: label ${new_label} already exists`);
      return true;
    }
  }
  return false;
}

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
