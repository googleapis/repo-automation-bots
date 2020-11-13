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

import {Storage} from '@google-cloud/storage';

/**
 * A simple library for parsing snippets.json file.
 *
 * Here is an example data of this file:
 * {
 *   "accessapproval_install_without_bom": {
 *     "title": "Install without bom",
 *     "description": null,
 *     "languages": {
 *       "MAVEN_POM": {
 *         "status": "IMPLEMENTED", // or "CONFLICT"
 *         "current_locations": [
 *           {
 *             "repository_path": "googleapis/java-accessapproval",
 *             "filename": "samples/install-without-bom/pom.xml",
 *             "commit": "a4b4143ee94d70a5486d96b9df2903fbba57e0d6",
 *             "branch": "master"
 *           }
 *         ]
 *       }
 *     }
 *   },
 * }
 */

const storage = new Storage();

export type SnippetStatus = 'IMPLEMENTED' | 'CONFLICT';

export interface SnippetLocation {
  repository_path: string;
  filename: string;
  commit: string;
  branch: string;
}

export interface SnippetLanguage {
  status: SnippetStatus;
  current_locations: Array<SnippetLocation>;
}

export interface Snippet {
  title: string;
  description: string;
  languages: Map<string, SnippetLanguage>;
}

export const getSnippets = async (
  dataBucket: string
): Promise<Map<string, Snippet>> => {
  const snippets = await storage
    .bucket(dataBucket)
    .file('snippets.json')
    .download();
  const parsedResponse = JSON.parse(snippets[0].toString());
  const ret = new Map<string, Snippet>();
  for (const k in parsedResponse) {
    const languageMap = new Map<string, SnippetLanguage>();
    for (const k2 in parsedResponse[k].languages) {
      languageMap.set(k2, parsedResponse[k].languages[k2]);
    }
    parsedResponse[k].languages = languageMap;
    ret.set(k, parsedResponse[k]);
  }
  return ret;
};
