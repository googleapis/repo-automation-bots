/**
 * Copyright 2019 Google LLC. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// define types for a few modules used by probot that do not have their
// own definitions published. Before taking this step, folks should first
// check whether type bindings are already published.

const GenerateBot = require("../main.js");
const { expect } = require("chai");
const fs = require("fs");
const recursive = require("recursive-readdir");
const rimraf = require("rimraf");
const snapshot = require("snap-shot-it");
const path = require("path");

const readAllFiles = function(dirNameRead, contentString) {
  const files = fs.readdirSync(dirNameRead);
  contentString = contentString || null;
  files.forEach(function(file) {
    const readName = path.join(dirNameRead, file);
    if (fs.statSync(readName).isDirectory()) {
      readAllFiles(readName, contentString);
    } else {
      contentString += fs.readFileSync(readName);
    }
  });
  console.log(contentString);
  return contentString;
};

describe("file structure", () => {
  it("checks that file structure carries over", async () => {
    const originalStack = await recursive("./templates");
    GenerateBot.creatingBotFiles("./templates", {
      programName: "{{programName}}",
      description: "description",
      fileLocation: "./tmp"
    });
    let createdStack = await recursive("./tmp");
    createdStack = createdStack.map(contents => {
      return contents.replace(/tmp/, "templates");
    });
    console.log("OG " + originalStack);
    console.log("CS " + createdStack);
    expect(originalStack).to.have.members(createdStack);
  });

  afterEach(() => {
    rimraf.sync("./tmp");
  });

  it("checks that the file content carries over", async () => {
    GenerateBot.creatingBotFiles("./templates", {
      programName: "helloWorld",
      description: "says hi",
      fileLocation: "./helloWorld"
    });

    const contentString = "Start of snapshot: ";
    return snapshot(readAllFiles("./helloWorld", contentString));
  });

  afterEach(() => {
    rimraf.sync("./helloWorld");
  });
});

describe("user input", () => {
  it("checks that user input is being checked correctly", () => {
    let validityWorkingWell = true;
    const hyphenTest = GenerateBot.checkValidity({
      programName: "does-not-pass",
      description: "pass",
      fileLocation: "pass"
    });

    const integerTest = GenerateBot.checkValidity({
      programName: "pass",
      description: "5oesN0tP4SS",
      fileLocation: "pass"
    });

    const nullTest = GenerateBot.checkValidity({
      programName: "",
      description: "pass",
      fileLocation: "../pass"
    });

    const overWritingTest = GenerateBot.checkValidity({
      programName: "templates",
      description: "pass",
      fileLocation: "./templates"
    });

    const programNameToLower = {
      programName: "PassButMakeLowerCase",
      description: "pass",
      fileLocation: "pass"
    };
    GenerateBot.checkValidity(programNameToLower);

    const fileLocationDefault = {
      programName: "pass",
      description: "pass",
      fileLocation: ""
    };
    GenerateBot.checkValidity(fileLocationDefault);

    console.log(hyphenTest);
    console.log(nullTest);
    console.log(integerTest);
    console.log(overWritingTest);
    console.log(programNameToLower.programName);
    console.log(fileLocationDefault.fileLocation);

    const regex = new RegExp("packages/pass");

    if (
      !hyphenTest &&
      !nullTest &&
      !integerTest &&
      !overWritingTest &&
      programNameToLower.programName === "passbutmakelowercase" &&
      regex.test(fileLocationDefault.fileLocation)
    ) {
      validityWorkingWell = true;
    } else {
      validityWorkingWell = false;
    }
    expect(validityWorkingWell).to.be.true;
  });
});
