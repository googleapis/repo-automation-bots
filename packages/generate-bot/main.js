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
//

const {prompt} = require('enquirer');
const Handlebars = require('handlebars');
const fs = require('fs');
const path = require('path');
const process = require('process');

exports.checkValidity = function(testString) {
  let isValid = true;
  const relativePath = path.resolve('./packages');
  const validName = /[^-A-Za-z_]+/;
  let string = JSON.stringify(testString);
  string = string
    .replace('{"programName":', '')
    .replace(',"description":', '')
    .replace(',"fileLocation":', '')
    .replace(/"/g, '')
    .replace(/}$/, '');

  console.log(string);
  if (validName.test(string)) {
    isValid = false;
    console.log(
      'You used an invalid character, like an integer. Please try again.'
    );
    return isValid;
  }

  if (isValid && !testString.programName) {
    isValid = false;
    console.log('You forgot to name your program. Please try again.');
    return isValid;
  }

  if (isValid && !testString.fileLocation) {
    testString.fileLocation = path.join(relativePath, testString.programName);
  }

  if (isValid && fs.existsSync(path.join(testString.fileLocation))) {
    isValid = false;
    console.log('Your progam name and location is not unique. Please rename.');
    return isValid;
  }

  if (
    isValid &&
    testString.programName &&
    testString.programName.charAt(0) ===
      testString.programName.charAt(0).toUpperCase()
  ) {
    testString.programName = testString.programName.toLowerCase();
  }

  return isValid;
};

exports.collectUserInput = async function() {
  let isValid = false;
  let input = null;
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

    isValid = exports.checkValidity(input);
  }

  return input;
};

exports.creatingBotFiles = function(dirname, data) {
  fs.mkdirSync(`${data.fileLocation}`);
  console.log(`${data.fileLocation}` + ' generated');

  const mkDir = `${data.fileLocation}`;

  const readAllFiles = function(dirNameRead, dirNameWrite) {
    const files = fs.readdirSync(dirNameRead);
    files.forEach(file => {
      const fileName = file.toString();
      const fileNameTemplate = Handlebars.compile(fileName);
      const fileNameResult = fileNameTemplate(data);
      const readName = path.join(dirNameRead, file);
      const writeName = path.join(dirNameWrite, fileNameResult);
      if (fs.statSync(readName).isDirectory()) {
        fs.mkdirSync(writeName);
        console.log(writeName + ' generated');
        readAllFiles(readName, writeName);
      } else {
        const fileContents = fs.readFileSync(readName);
        const template = Handlebars.compile(fileContents.toString());
        const result = template(data);
        console.log(writeName + ' generated');
        fs.writeFileSync(writeName, result);
      }
    });
  };
  readAllFiles(dirname, mkDir);
};
