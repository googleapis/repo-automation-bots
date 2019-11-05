const GenerateBot = require("../main.js");
const { expect } = require("chai");
const fs = require("fs");
const recursive = require("recursive-readdir");
const rimraf = require("rimraf");
const snapshot = require("snap-shot");

describe("file structure", () => {
  it("checks that file structure carries over", async () => {
    const originalStack = await recursive("./templates");
    GenerateBot.creatingBotFiles("./templates", {
      programName: "programName",
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
      fileLocation: "./tmp"
    });
    const files = await recursive("./tmp");
    let stringOfFiles = null;
    for (let i = 0; i < files.length; i++) {
      stringOfFiles += fs.readFileSync(files[i], "utf8");
    }
    console.log(stringOfFiles);
    return snapshot(stringOfFiles);
    //implement snapshot logic here that reads the contents of the files recursively
  });

  afterEach(() => {
    rimraf.sync("./tmp");
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
    const nullTest = GenerateBot.checkValidity({
      programName: null,
      description: "pass",
      fileLocation: "../pass"
    });
    const integerTest = GenerateBot.checkValidity({
      programName: "pass",
      description: "d3oesN0tP4SS",
      fileLocation: "pass"
    });

    let programNameToLower = {
      programName: "PassButMakeLowerCase",
      description: "pass",
      fileLocation: "pass"
    }
    GenerateBot.checkValidity(programNameToLower);

    let fileLocationDefault = {
      programName: "pass",
      description: "pass",
      fileLocation: null,
    }
    GenerateBot.checkValidity(fileLocationDefault);

    if (!hyphenTest && !nullTest && !integerTest && (programNameToLower.programName == 'passbutmakelowercase' ) && (fileLocationDefault.fileLocation == '../pass')) {
      validityWorkingWell = true;
    } else {
      validityWorkingWell = false;
    }
    expect(validityWorkingWell).to.be.true;
  });
});