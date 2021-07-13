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

export enum Platform {
  CLOUD_FUNCTIONS = 'Cloud Functions',
  CLOUD_RUN = 'Cloud Run',
}

export interface ProgramOptions {
  programName: string;
  exportName?: string;
  description: string;
  fileLocation: string;
  platform: Platform;
}

export function checkValidity(opts: ProgramOptions) {
  const validName = /[^-A-Za-z_]+/;
  const botName = opts.programName;

  if (validName.test(botName)) {
    console.log(
      'Only letters, hyphens, and underscores are permitted in the bot name. Please try again.'
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
  opts.exportName = opts.programName.replace(/-/g, '_');
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
      {
        type: 'select',
        name: 'platform',
        message: 'Select a platform',
        choices: Object.values(Platform),
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
  fs.mkdirSync(options.fileLocation, {recursive: true});

  const mkDir = options.fileLocation;
  const handlebarsFileRegex = /.hbs$/;

  // enables easier/convenient platform checking within hbs files
  const [platformKey] = Object.entries(Platform).find(
    ([, value]) => value === options.platform
  )!;
  const handlebarsOptions = {...options, platform: {[platformKey]: true}};

  const readAllFiles = function (dirNameRead: string, dirNameWrite: string) {
    console.log(`copying from ${dirNameRead} to ${dirNameWrite}...`);
    const files = fs.readdirSync(dirNameRead);
    files.forEach(file => {
      const fileName = file.toString();
      const isHandlebarsFile = handlebarsFileRegex.test(fileName);
      let fileNameResult = fileName;

      if (isHandlebarsFile) {
        const fileNameTemplate = Handlebars.compile(fileName);
        fileNameResult = fileNameTemplate(handlebarsOptions).replace(
          handlebarsFileRegex,
          ''
        );
      }

      const readName = path.join(dirNameRead, file);
      const writeName = path.join(dirNameWrite, fileNameResult);
      if (fs.statSync(readName).isDirectory()) {
        fs.mkdirSync(writeName);
        console.log(writeName + ' generated');
        readAllFiles(readName, writeName);
      } else {
        if (isHandlebarsFile) {
          const fileContents = fs.readFileSync(readName);
          const template = Handlebars.compile(fileContents.toString());
          fs.writeFileSync(writeName, template(handlebarsOptions));
        } else {
          fs.copyFileSync(readName, writeName);
        }

        console.log(writeName + ' generated');
      }
    });
  };
  const templatePath = path.join(__dirname, '..', '..', 'templates');
  readAllFiles(templatePath, mkDir);
}
