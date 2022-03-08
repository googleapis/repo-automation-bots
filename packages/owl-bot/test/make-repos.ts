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

import tmp from 'tmp';
import {makeDirTree} from './dir-tree';
import * as fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import {OwlBotYaml, DEFAULT_OWL_BOT_YAML_PATH} from '../src/config-files';
import {newCmd} from '../src/cmd';

/**
 * Makes a repo with three commits and 3 simple text files.
 * Useful as a copy source repo for tests.
 * @returns the local file path to the new repo
 */
export function makeAbcRepo(logger = console): string {
  const cmd = newCmd(logger);

  // Create a git repo.
  const dir = tmp.dirSync().name;
  cmd('git init -b main', {cwd: dir});
  cmd('git config user.email "test@example.com"', {cwd: dir});
  cmd('git config user.name "test"', {cwd: dir});

  // Add 3 commits
  makeDirTree(dir, ['a.txt:1']);
  cmd('git add -A', {cwd: dir});
  cmd('git commit -m a', {cwd: dir});

  makeDirTree(dir, ['b.txt:2']);
  cmd('git add -A', {cwd: dir});
  cmd('git commit -m b', {cwd: dir});

  makeDirTree(dir, ['c.txt:3']);
  cmd('git add -A', {cwd: dir});
  cmd('git commit -m c', {cwd: dir});
  return dir;
}

/**
 * Makes a repo that contains a single file: .OwlBot.yaml.
 * Useful as the copy dest repo for tests.
 * @returns the local file path to the new repo
 */
export function makeRepoWithOwlBotYaml(
  owlBotYaml: OwlBotYaml,
  logger = console
): string {
  const cmd = newCmd(logger);

  const dir = tmp.dirSync().name;
  cmd('git init -b main', {cwd: dir});
  cmd('git config user.email "test@example.com"', {cwd: dir});
  cmd('git config user.name "test"', {cwd: dir});

  const yamlPath = path.join(dir, DEFAULT_OWL_BOT_YAML_PATH);
  fs.mkdirSync(path.dirname(yamlPath), {recursive: true});
  const text = yaml.dump(owlBotYaml);
  fs.writeFileSync(yamlPath, text);

  cmd('git add -A', {cwd: dir});
  cmd('git commit -m "Hello OwlBot"', {cwd: dir});

  return dir;
}
