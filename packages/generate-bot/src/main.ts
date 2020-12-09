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

import {prompt} from 'enquirer';
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';
import process from 'process';

export interface ProgramOptions {
  programName: string;
  exportName?: string;
  description: string;
  fileLocation: string;
}

export function checkValidity(opts: ProgramOptions) {
  const validName = /[^-A-Za-z_\s]+/;
  let string = JSON.stringify(opts);
  string = string
    .replace('{"programName":', '')
    .replace(',"description":', '')
    .replace(',"fileLocation":', '')
    .replace(/"/g, '')
    .replace(/}$/, '');

  if (validName.test(string)) {
    console.log(
      'You used an invalid character, like an integer. Please try again.'
    );
    return false;
  }

  if (!opts.programName) {
    console.log('You forgot to name your program. Please try again.');
    return false;
  }

  const relativePath = path.join(__dirname, '..', '..', '..');
  if (!opts.fileLocation) {
    opts.fileLocation = path.join(relativePath, opts.programName);
  }

  if (fs.existsSync(path.join(opts.fileLocation))) {
    console.log('Your progam name and location is not unique. Please rename.');
    return false;
  }
  opts.programName = opts.programName.toLowerCase();
  opts.exportName = opts.programName.replace('-', '_');
  return true;
}

export async function collectUserInput(): Promise<ProgramOptions> {
  let isValid = false;
  let input: ProgramOptions;
  while (!isValid) {
    input = await prompt([
      {
        type: 'input',
        name: 'programName',
        message: 'What is the name of the program?',
      },
      {
        type: 'input',
        name: 'description',
        message: 'What is the description of the program?',
      },
      {
        type: 'input',
        name: 'fileLocation',
        message: `This package will be saved in /packages/yourProgramName unless you specify another location and directory name here relative to ${process.cwd()} : `,
      },
    ]);
    isValid = checkValidity(input);
  }
  return input!;
}

/**
 * Copy a set of templates, and render a new bot on disk.
 * @param templatePath The fully qualified path to the template project to be copied
 * @param options Options for creating the new bot
 */
export function creatingBotFiles(options: ProgramOptions) {
  console.log(`Creating new folder ${options.fileLocation}`);
  fs.mkdirSync(options.fileLocation);
  const mkDir = options.fileLocation;
  const readAllFiles = function (dirNameRead: string, dirNameWrite: string) {
    console.log(`copying from ${dirNameRead} to ${dirNameWrite}...`);
    const files = fs.readdirSync(dirNameRead);
    files.forEach(file => {
      const fileName = file.toString();
      const fileNameTemplate = Handlebars.compile(fileName);
      const fileNameResult = fileNameTemplate(options);
      const readName = path.join(dirNameRead, file);
      const writeName = path.join(dirNameWrite, fileNameResult);
      if (fs.statSync(readName).isDirectory()) {
        fs.mkdirSync(writeName);
        console.log(writeName + ' generated');
        readAllFiles(readName, writeName);
      } else {
        const fileContents = fs.readFileSync(readName);
        const template = Handlebars.compile(fileContents.toString());
        const result = template(options);
        console.log(writeName + ' generated');
        fs.writeFileSync(writeName, result);
      }
    });
  };
  const templatePath = path.join(__dirname, '..', '..', 'templates');
  readAllFiles(templatePath, mkDir);
}
