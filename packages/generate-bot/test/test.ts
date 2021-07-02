// Copyright 2019 Google LLC
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

import * as GenerateBot from '../src/main';
import fs from 'fs';
import recursive from 'recursive-readdir';
import rimraf from 'rimraf';
import os from 'os';
import path from 'path';
import {describe, it, afterEach} from 'mocha';
import * as assert from 'assert';
import {execSync, ExecSyncOptions} from 'child_process';

const readAllFiles = function (
  dirNameRead: string,
  contentString: string | string[]
): string {
  const files = fs.readdirSync(dirNameRead).sort();
  contentString = contentString || [];
  files.forEach(file => {
    const readName = path.join(dirNameRead, file);
    if (fs.statSync(readName).isDirectory()) {
      contentString = readAllFiles(readName, contentString);
    } else {
      if (!readName.includes('package.json')) {
        contentString += fs.readFileSync(readName, 'utf8');
      }
    }
  });
  return contentString as string;
};

describe('file structure', () => {
  it('checks that file structure carries over', async () => {
    const originalStack = await recursive('./templates');
    GenerateBot.creatingBotFiles({
      programName: '{{programName}}',
      exportName: '{{exportName}}',
      description: 'description',
      fileLocation: './tmp',
    });
    let createdStack = await recursive('./tmp');
    createdStack = createdStack.map(contents => {
      return contents.replace(/tmp/, 'templates');
    });
    for (const key of createdStack) {
      assert.ok(originalStack.includes(key));
    }
  });

  afterEach(done => {
    rimraf('./tmp', done);
  });

  it('checks that the file content carries over', async () => {
    GenerateBot.creatingBotFiles({
      programName: 'helloWorld',
      description: 'says hi',
      fileLocation: './helloWorld',
    });
    const content = readAllFiles('./helloWorld', '').replace(/\r/g, '');
    assert.ok(content);
  });

  afterEach(() => {
    rimraf.sync('./helloWorld');
  });
});

describe('user input', () => {
  it('checks that integers and other characters are not passed', () => {
    const integerTest = GenerateBot.checkValidity({
      programName: 'does,notpass',
      description: '5oesN0tP4SS',
      fileLocation: 'pass',
    });
    assert.strictEqual(integerTest, false);
  });

  it('checks that only valid characters are passed', () => {
    const validCharTest = GenerateBot.checkValidity({
      programName: 'pas-s',
      description: 'pas_s',
      fileLocation: 'pass',
    });
    assert.strictEqual(validCharTest, true);
  });

  it('checks that nulls are not passed', () => {
    const nullTest = GenerateBot.checkValidity({
      programName: '',
      description: 'pass',
      fileLocation: '../pass',
    });
    assert.strictEqual(nullTest, false);
  });

  it('checks that files are not overwritten', () => {
    const overWritingTest = GenerateBot.checkValidity({
      programName: 'templates',
      description: 'pass',
      fileLocation: './templates',
    });
    assert.strictEqual(overWritingTest, false);
  });

  it('checks that the program name is not upper-cased', () => {
    const programNameToLower = {
      programName: 'PassButMakeLowerCase',
      description: 'pass',
      fileLocation: 'pass',
    };
    GenerateBot.checkValidity(programNameToLower);
    assert.strictEqual(programNameToLower.programName, 'passbutmakelowercase');
  });

  it('checks that the program has a default location', () => {
    const fileLocationDefault = {
      programName: 'pass',
      description: 'pass',
      fileLocation: '',
    };
    GenerateBot.checkValidity(fileLocationDefault);
    const fileLocation = fileLocationDefault.fileLocation
      .toString()
      .replace(/\\/g, '/');

    const regexLinux = new RegExp('packages/pass');
    assert.strictEqual(regexLinux.test(fileLocation), true);
  });

  it('checks that the export name uses underscores', () => {
    const programNameWithDash: GenerateBot.ProgramOptions = {
      programName: 'with-dash',
      description: 'pass',
      fileLocation: 'pass',
    };
    GenerateBot.checkValidity(programNameWithDash);
    assert.strictEqual(programNameWithDash.exportName, 'with_dash');
  });
});

describe('end to end', () => {
  const programName = 'testy';
  const tempPath = path.join(os.tmpdir(), programName);
  it('should generate a working package', async () => {
    await GenerateBot.creatingBotFiles({
      programName,
      description: programName,
      fileLocation: tempPath,
    });
    const execOptions: ExecSyncOptions = {
      cwd: tempPath,
      stdio: 'inherit',
      encoding: 'utf8',
    };
    execSync('npm install', execOptions);
    execSync('npm test', execOptions);
  });

  after(done => {
    rimraf(tempPath, done);
  });
});
