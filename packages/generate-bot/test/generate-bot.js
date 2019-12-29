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
const {describe, it, afterEach} = require('mocha');

const readAllFiles = function(dirNameRead, contentString) {
  const files = fs.readdirSync(dirNameRead).sort();
  console.log("files: " + files);
  contentString = contentString || [];
  files.forEach(function(file) {
    const readName = path.join(dirNameRead, file);
    if (fs.statSync(readName).isDirectory()) {
      console.log("directory: " + readName);
      contentString = readAllFiles(readName, contentString);
    } else {
      contentString += fs.readFileSync(readName, "utf8");
    }
  });
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

    const contentString = "";
    const string = readAllFiles("./helloWorld", contentString).replace(
      /\r/g,
      ""
    );
    return snapshot(string);
  });

  afterEach(() => {
    rimraf.sync("./helloWorld");
  });
});

describe("user input", () => {
  it("checks that hyphens are not passed", () => {
    const hyphenTest = GenerateBot.checkValidity({
      programName: "does-not-pass",
      description: "pass",
      fileLocation: "pass"
    });
    expect(hyphenTest).to.be.false;
  });

  it("checks that integers are not passed", () => {
    const integerTest = GenerateBot.checkValidity({
      programName: "pass",
      description: "5oesN0tP4SS",
      fileLocation: "pass"
    });

    expect(integerTest).to.be.false;
  });

  it("checks that nulls are not passed", () => {
    const nullTest = GenerateBot.checkValidity({
      programName: "",
      description: "pass",
      fileLocation: "../pass"
    });

    expect(nullTest).to.be.false;
  });

  it("checks that files are not overwritten", () => {
    const overWritingTest = GenerateBot.checkValidity({
      programName: "templates",
      description: "pass",
      fileLocation: "./templates"
    });
    expect(overWritingTest).to.be.false;
  });

  it("checks that the program name is not upper-cased", () => {
    const programNameToLower = {
      programName: "PassButMakeLowerCase",
      description: "pass",
      fileLocation: "pass"
    };
    GenerateBot.checkValidity(programNameToLower);
    expect(programNameToLower.programName).to.equal("passbutmakelowercase");
  });

  it("checks that the program has a default location", () => {
    const fileLocationDefault = {
      programName: "pass",
      description: "pass",
      fileLocation: ""
    };
    GenerateBot.checkValidity(fileLocationDefault);
    const fileLocation = fileLocationDefault.fileLocation
      .toString()
      .replace(/\\/g, "/");

    const regexLinux = new RegExp("packages/pass");
    expect(regexLinux.test(fileLocation)).to.be.true;
  });
});
