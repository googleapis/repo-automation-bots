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

import { Context } from 'probot';
import { logger } from 'gcf-utils';

// Default app configs if user didn't specify a .config
const default_configs = {
  product: true,
  language: {
    issue: false,
    pullrequest: false
  }
};

// A mapping of languages to their file extensions
const defaultExtensions = require('./extensions.json');

/**
 * hasLangLabel
 * Checks whether there already exists a "lang:" label
 */
function langLabelExists(context: Context) : boolean {
  let labels = context.payload.issue ? context.payload.issue.labels : context.payload.pull_request.labels;
  for (let label of labels) {
    if (label.name.includes("lang: ")) {
      logger.info("Exiting - language tag already exists: " + label.name);
      return true
    }
  }
  return false
}

function getLanguageFromPathConfig(filename: string, config: any) : string {
  // If user specified languages for discrete paths
  let lang = "";
  const dirs = filename.split("/");
  let path_obj = config.paths;
  // If user set default language for entire drive, use that language
  if ('.' in path_obj) lang = path_obj['.'];
  for (let dir of dirs) {
    if (dir in path_obj) {
      if ('.' in path_obj) lang = path_obj['.'];
      if (typeof path_obj[dir] === 'string') {
        lang = path_obj[dir];
        break; // break as this is the end of user defined path
      } else {
        path_obj=path_obj[dir];
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
function getFileLanguage(filename: string, config: any) : string {
  // 1. Return language if file path is user defined
  console.log("in getFileLanguage");
  console.log("config:");
  console.log(config);
  console.log("config.extensions");
  console.log(config.extensions);
  if (config.paths) {
    console.log("User has configured paths");
    let lang = getLanguageFromPathConfig(filename, config);
    if (lang) {
      if (config.labelprefix) return config.labelprefix + lang;
      return "lang: " + lang;
    }
  }

  // 2. Return language based on extension matching
  const extensionMap = config.extensions ?
      {...config.extensions, ...defaultExtensions}
      : defaultExtensions;
  console.log("extension map with user configs: ");
  // console.log(extensionMap);
  let ext: string = filename.substring(filename.lastIndexOf('.') + 1);
  let lang = Object.keys(extensionMap).find(key => extensionMap[key].includes(ext));
  if (!lang) return "";
  if (config.labelprefix) return config.labelprefix + lang;
  return "lang: " + lang;
}

/**
 * FileData
 * Extracting relevant data from each file changed from github.pulls.listFiles
 */
interface FileData {
  filename: string
  changes: number
}

/**
 * getPRLanguage
 * Output: "lang: language"
 * Interprets the language of a given file
 * Returns the highest occurring language across all files in a PR
 */
function getPRLanguage(data: FileData[], config: any) : string {
  console.log("getPRlanguage");
  let counts = data.reduce(function(counted: {[key:string]: number}, file) {
    let l = getFileLanguage(file.filename, config);
    if (l) {
      if (!counted[l]) {
        counted[l] = file.changes;
      } else {
        counted[l] += file.changes;
      }
    }
    return counted;
  }, {});

  let label = Object.keys(counts).sort(function (a,b) {
    return counts[b]-counts[a]
  });
  logger.info("Detected languages based on files extensions are: " + label);
  return label[0];
}

module.exports = {
  getPRLanguage,
  langLabelExists,
};
