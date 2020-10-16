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

// A mapping of languages to their file extensions
// eslint-disable-next-line @typescript-eslint/no-var-requires
const defaultExtensions = require('./extensions.json');

/**
 * labelExists:
 * Checks whether the intended label already exists
 */
function labelExists(context: Context, new_label: string): boolean {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getLabelFromPathConfig(filename: string, config: any): string {
  // If user specified languages for discrete paths
  let lang = '';
  const dirs = filename.split('/');
  let path_obj = config.paths;
  // If user set default language for entire drive, use that language
  if ('.' in path_obj) lang = path_obj['.'];
  for (const dir of dirs) {
    if (dir in path_obj) {
      if ('.' in path_obj) lang = path_obj['.'];
      if (typeof path_obj[dir] === 'string') {
        lang = path_obj[dir];
        break; // break as this is the end of user defined path
      } else {
        path_obj = path_obj[dir];
      }
    } else {
      break; // break as this is the end of user defined path
    }
  }
  return lang;
}

/**
 *  getFileLabel
 *  @param filename
 *  Output: "[prefix]label" or "" if no matches were found
 *  For language labeling, if no user specified labels are found
 *  it will default to language mappings in extensions.json
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getFileLabel(filename: string, config: any, type: string): string {
  // Return a label based if user defined a file path label
  if (config.paths) {
    const lang = getLabelFromPathConfig(filename, config);
    if (lang) {
      if (config.labelprefix) return config.labelprefix + lang;
      return lang;
    }
  }

  // Return language label based on extension matching
  if (type === 'language') {
    const extensionMap = config.extensions
      ? {...config.extensions, ...defaultExtensions}
      : defaultExtensions;
    const ext: string = filename.substring(filename.lastIndexOf('.') + 1);
    const lang = Object.keys(extensionMap).find(key =>
      extensionMap[key].includes(ext)
    );
    if (!lang) return '';
    if (config.labelprefix) return config.labelprefix + lang;
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getLabel(data: FileData[], config: any, type: string): string {
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

module.exports = {
  getLabel,
  labelExists,
};
