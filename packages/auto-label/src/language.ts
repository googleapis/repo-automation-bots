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

import {Context} from 'probot';
import {logger} from 'gcf-utils';

// A mapping of languages to their file extensions
const defaultExtensions = require('./extensions.json');

/**
 * hasLangLabel
 * Checks whether there already exists a "lang:" label
 */
function langLabelExists(context: Context): boolean {
  const labels = context.payload.issue
    ? context.payload.issue.labels
    : context.payload.pull_request.labels;
  for (const label of labels) {
    if (label.name.includes('lang: ')) {
      logger.info('Exiting - language tag already exists: ' + label.name);
      return true;
    }
  }
  return false;
}

function getLanguageFromPathConfig(filename: string, config: any): string {
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
 *  getFileLanguage
 *  @param filename
 *  Output: "lang: language" or "" if no matches were found
 *  Only extensions & languages whitelisted in extensions.json are labeled
 *  Ignores files without . extensions, e.g. Dockerfile, LICENSE
 */
function getFileLanguage(filename: string, config: any): string {
  // 1. Return language if file path is user defined
  if (config.paths) {
    const lang = getLanguageFromPathConfig(filename, config);
    if (lang) {
      if (config.labelprefix) return config.labelprefix + lang;
      return 'lang: ' + lang;
    }
  }

  // 2. Return language based on extension matching
  const extensionMap = config.extensions
    ? {...config.extensions, ...defaultExtensions}
    : defaultExtensions;
  const ext: string = filename.substring(filename.lastIndexOf('.') + 1);
  const lang = Object.keys(extensionMap).find(key =>
    extensionMap[key].includes(ext)
  );
  if (!lang) return '';
  if (config.labelprefix) return config.labelprefix + lang;
  return 'lang: ' + lang;
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
 * getPRLanguage
 * Output: "lang: language"
 * Interprets the language of a given file
 * Returns the highest occurring language across all files in a PR
 */
function getPRLanguage(data: FileData[], config: any): string {
  const counts = data.reduce((counted: {[key: string]: number}, file) => {
    const l = getFileLanguage(file.filename, config);
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
  logger.info('Detected languages based on files extensions are: ' + label);
  return label[0];
}

module.exports = {
  getPRLanguage,
  langLabelExists,
};
