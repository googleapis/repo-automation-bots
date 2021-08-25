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
import {newCmd} from './cmd';
import path from 'path';
import * as fs from 'fs';

/**
 * Run `Bazel build ...` in googleapis/googleapis to build tar balls of source
 * code.  This function unpacks those tarballs into the same directory structure
 * as googleapis-gen.
 * @param bazelBinDir path to build output directory; should always end with bazel-bin.
 * @param outDir directory where tarballs will be unpacked; corresponds to
 *               googleapis/googleapis-gen.
 * @param buildTargetStem only unpack tarballs whose paths have a common stem;
 *                        empty means unpack all the tarballs.
 */
export function unpackTarBalls(
  bazelBinDir: string,
  outDir: string,
  buildTargetStem = '',
  logger = console
) {
  const cmd = newCmd(logger);
  const pattern = makeTarBallPattern(buildTargetStem);
  const tarBalls = glob.sync(pattern, {cwd: bazelBinDir});
  for (const tarBall of tarBalls) {
    const parentDir = path.dirname(tarBall);
    const tarBallFullPath = path.join(bazelBinDir, tarBall);
    const targetDir = path.join(outDir, parentDir);
    fs.mkdirSync(targetDir, {recursive: true});
    cmd(`tar xf ${tarBallFullPath} -C ${targetDir}`);
  }
}

////////////////////////////////////////////////////////////////////////////
// Unpacking *all* the tarballs would take a while and annoy users.
// The following functions select just the relevant tarballs.

// Exported for testing purposes only.
export function makeTarBallPattern(buildTargetStem: string): string {
  // Strip leading / if present.
  const stem = buildTargetStem.replace(/^\/+/, '');
  // Construct the glob pattern.
  // a/bc => a/bc*/**/*.tar.gz
  // a/bc/ => a/bc/**/*.tar.gz
  const lastStemChar = stem.length ? stem[stem.length - 1] : '/';
  return lastStemChar === '/' ? stem + '**/*.tar.gz' : stem + '*/**/*.tar.gz';
}

/**
 * Finds the common directory stem across a range of regular expressions.
 */
export function getCommonStem(regexps: string[]): string {
  if (regexps.length < 1) {
    return '';
  }
  let stem = regexps[0];
  for (const regexp of regexps.slice(1)) {
    stem = getCommonPrefix(regexp, stem);
  }
  // Cut any regular expression characters off the stem.
  const controlCharIndex = stem.search(/[-[\]{}()*+?.,\\^$|#\s]/g);
  return controlCharIndex < 0 ? stem : stem.slice(0, controlCharIndex);
}

function getCommonPrefix(a: string, b: string): string {
  // eslint-disable-next-line
  for (let i = 0; true; ++i) {
    if (i >= a.length) {
      return a;
    }
    if (i >= b.length) {
      return b;
    }
    if (a[i] !== b[i]) {
      return a.slice(0, i);
    }
  }
}
