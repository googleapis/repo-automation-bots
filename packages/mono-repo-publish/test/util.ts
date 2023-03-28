// Copyright 2023 Google LLC
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

import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';

/// Makes a temporary directory that contains:
/// /subdirName
/// /subdirName/older.tgz
/// /subdirName/newer.tgz
/// /subdirName/newest.tar
export async function makeTempDirWithTarballs(
  subdirName: string
): Promise<string> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test'));
  // Create the foo directory and some files.
  fs.mkdirSync(path.join(tmpDir, subdirName), {recursive: true});
  // The newer tarball should be picked up.
  fs.writeFileSync(path.join(tmpDir, subdirName, 'older.tgz'), 'older');
  await new Promise(resolve => setTimeout(resolve, 10));
  fs.writeFileSync(path.join(tmpDir, subdirName, 'newer.tgz'), 'newer');
  // Ignored because it doesn't have extension .tgz.
  await new Promise(resolve => setTimeout(resolve, 10));
  fs.writeFileSync(path.join(tmpDir, subdirName, 'newest.tar'), 'newest');
  return tmpDir;
}
