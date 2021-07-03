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
import crypto from 'crypto';
import fs from 'fs';
import recursive from 'recursive-readdir';
import rimraf from 'rimraf';
import os from 'os';
import path from 'path';
import {describe, it} from 'mocha';
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

let tempTestDirectory: string;
let fileLocation: string;
let defaultProgramOptions: GenerateBot.ProgramOptions;

before(() => {
  tempTestDirectory = fs.mkdtempSync(`${os.tmpdir()}${path.sep}`);
});

beforeEach(() => {
  const suffix = crypto.randomBytes(16).toString('hex');

  fileLocation = path.join(tempTestDirectory, suffix);
  defaultProgramOptions = {
    programName: '{{programName}}',
    exportName: '{{exportName}}',
    description: '{{description}}',
    fileLocation,
    platform: GenerateBot.Platform.CLOUD_FUNCTIONS,
  };
});

after(() => {
  // cleanup temp directory
  rimraf.sync(tempTestDirectory);
});

describe('file structure', () => {
  it('checks that file structure carries over', async () => {
    const originalStack = await recursive('./templates');
    GenerateBot.creatingBotFiles({
      ...defaultProgramOptions,
    });

    const createdStack = (await recursive(fileLocation)).map(contents =>
      contents.replace(fileLocation, 'templates')
    );

    for (const key of createdStack) {
      assert.ok(originalStack.includes(key));
    }
  });

  it('should create identical files for each platform', async () => {
    let lastStack: string[] = [];

    for (const platform of Object.values(GenerateBot.Platform)) {
      const platformFileLocation = path.join(fileLocation, platform);

      GenerateBot.creatingBotFiles({
        ...defaultProgramOptions,
        platform,
        fileLocation: platformFileLocation,
      });

      const createdStack = (await recursive(platformFileLocation))
        .map(contents => contents.replace(platformFileLocation, ''))
        .sort();

      if (lastStack.length) {
        assert.deepStrictEqual(lastStack, createdStack);
      }

      lastStack = createdStack;
    }
  });

  it('checks that the file content carries over', async () => {
    GenerateBot.creatingBotFiles({
      ...defaultProgramOptions,
      programName: 'helloWorld',
      description: 'says hi',
    });
    const content = readAllFiles(fileLocation, '').replace(/\r/g, '');
    assert.ok(content);
  });

  it('should create nested folders if they do not yet exist', async () => {
    GenerateBot.creatingBotFiles({
      ...defaultProgramOptions,
      programName: 'helloWorld',
      description: 'says hi',
      fileLocation: path.join(
        defaultProgramOptions.fileLocation,
        'nested',
        'directory'
      ),
    });
    const content = readAllFiles(fileLocation, '').replace(/\r/g, '');
    assert.ok(content);
  });
});

describe('user input', () => {
  it('checks that integers and other characters are not passed', () => {
    const integerTest = GenerateBot.checkValidity({
      ...defaultProgramOptions,
      programName: 'does,notpass',
      description: '5oesN0tP4SS',
    });
    assert.strictEqual(integerTest, false);
  });

  it('checks that only valid characters are passed', () => {
    const validCharTest = GenerateBot.checkValidity({
      ...defaultProgramOptions,
      programName: 'pas-s',
      description: 'pas_s',
    });
    assert.strictEqual(validCharTest, true);
  });

  it('checks that nulls are not passed', () => {
    const nullTest = GenerateBot.checkValidity({
      ...defaultProgramOptions,
      programName: '',
      description: 'pass',
    });
    assert.strictEqual(nullTest, false);
  });

  it('checks that files are not overwritten', () => {
    const overWritingTest = GenerateBot.checkValidity({
      ...defaultProgramOptions,
      programName: 'templates',
      description: 'pass',
      fileLocation: './templates',
    });
    assert.strictEqual(overWritingTest, false);
  });

  it('checks that the program name is not upper-cased', () => {
    const programNameToLower = {
      ...defaultProgramOptions,
      programName: 'PassButMakeLowerCase',
      description: 'pass',
    };
    assert.ok(GenerateBot.checkValidity(programNameToLower));
    assert.strictEqual(programNameToLower.programName, 'passbutmakelowercase');
  });

  it('checks that the program has a default location', () => {
    const fileLocationDefault = {
      ...defaultProgramOptions,
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
      ...defaultProgramOptions,
      programName: 'with-dash',
      description: 'pass',
    };
    assert.ok(GenerateBot.checkValidity(programNameWithDash));
    assert.strictEqual(programNameWithDash.exportName, 'with_dash');
  });
});

describe('end to end', () => {
  const programName = 'testy';

  for (const platform of Object.values(GenerateBot.Platform)) {
    describe(platform, () => {
      it('should generate a working package', async () => {
        await GenerateBot.creatingBotFiles({
          ...defaultProgramOptions,
          programName,
          description: programName,
          platform,
        });

        const execOptions: ExecSyncOptions = {
          cwd: fileLocation,
          stdio: 'inherit',
          encoding: 'utf8',
        };
        execSync('npm install', execOptions);
        execSync('npm test', execOptions);
      });
    });
  }
});
