// Copyright 2021 Google LLC
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
import glob from 'glob';
import path from 'path';
import * as fs from 'fs';

/**
 * Creates a directory structure with files.
 *
 * @param rootDir the root directory under which to create files and directories.
 * @param specs a list of files and directories in this format:
 *   files are specified by <path>:<content>  For example:
 *      "/x/y/hello.txt:Hello World"
 *   directories lack a colon:
 *      "/empty/dir"
 */
export function makeDirTree(rootDir: string, specs: string[]): void {
  for (const spec of specs) {
    const [apath, content] = spec.split(':', 2);
    const fpath = path.join(rootDir, apath);
    const dirName = content ? path.dirname(fpath) : fpath;
    fs.mkdirSync(dirName, {recursive: true});
    if (content) {
      fs.writeFileSync(fpath, content);
    }
  }
}

/**
 * Collects the entire source tree content into a list that can
 * be easily compared equal in a test.
 * @returns Sorted list in the following format.
 *   files are specified by <path>:<content>  For example:
 *      "/x/y/hello.txt:Hello World"
 *   directories lack a colon:
 *      "/empty/dir"
 */
export function collectDirTree(dir: string): string[] {
  return collectGlobResult(
    dir,
    glob.sync('**', {
      cwd: dir,
      dot: true,
      ignore: ['.git', '.git/**'],
    })
  );
}

/**
 * Collects the entire source tree content into a list that can
 * be easily compared equal in a test.
 * @returns Sorted list in the following format.
 *   files are specified by <path>:<content>  For example:
 *      "/x/y/hello.txt:Hello World"
 *   directories lack a colon:
 *      "/empty/dir"
 */
export function collectGlobResult(rootDir: string, paths: string[]): string[] {
  const tree: string[] = [];
  for (const apath of paths) {
    const fullPath = path.join(rootDir, apath);
    if (fs.lstatSync(fullPath).isDirectory()) {
      tree.push(apath);
    } else {
      const content = fs.readFileSync(fullPath, {encoding: 'utf8'});
      tree.push(`${apath}:${content}`);
    }
  }
  tree.sort();
  return tree;
}
