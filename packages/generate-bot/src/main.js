const { prompt } = require("enquirer");
const Handlebars = require("handlebars");
const fs = require("fs");
const path = require("path");
const process = require("process");

exports.checkValidity = function(testString) {
  let isValid = true;
  let relativePath = path.resolve(process.cwd(), 'packages');
  const invalidChars = ["-", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  const string = JSON.stringify(testString);
  for (let i = 0; i < invalidChars.length; i++) {
    if (string.includes(invalidChars[i])) {
      isValid = false;
      console.log(
        "You used an invalid character, like a hyphen or an integer. Please try again."
      );
      return isValid;
    }
  }

  if (isValid && !testString.programName) {
    isValid = false;
    console.log("You forgot to name your program. Please try again.");
    return isValid;
  }

  if (isValid && fs.existsSync(path.join(relativePath,testString.programName))) {
    isValid = false;
    console.log("Your progam name and location is not unique. Please rename.")
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

  if (isValid && !testString.fileLocation) {
    testString.fileLocation = path.join(relativePath, testString.programName);
    console.log(relativePath);
  }

  return isValid;
};

exports.collectUserInput = async function() {
  let isValid = false;
  let input = null;
  while (!isValid) {
    input = await prompt([
      {
        type: "input",
        name: "programName",
        message: "What is the name of the program?"
      },
      {
        type: "input",
        name: "description",
        message: "What is the description of the program?"
      },
      {
        type: "input",
        name: "fileLocation",
        message: `This package will be saved in /packages/yourProgramName unless you specify another location and directory name here relative to ${process.cwd()} : `
      }
    ]);

    isValid = exports.checkValidity(input);
  }

  return input;
};

exports.creatingBotFiles = function(dirname, data) {
  fs.mkdirSync(`${data.fileLocation}`);
  console.log(`${data.fileLocation}` + " generated");

  const mkDir = `${data.fileLocation}`;

  const readAllFiles = function(dirNameRead, dirNameWrite) {
    const files = fs.readdirSync(dirNameRead);
    files.forEach(function(file) {
      let fileName = file.toString();
      let fileNameTemplate = Handlebars.compile(fileName);
      let fileNameResult = fileNameTemplate(data);
      let readName = path.join(dirNameRead, file);
      let writeName = path.join(dirNameWrite, fileNameResult);
      if (fs.statSync(readName).isDirectory()) {
        fs.mkdirSync(writeName);
        console.log(writeName + " generated");
        readAllFiles(readName, writeName);
      } else {
        let fileContents = fs.readFileSync(readName);
        let template = Handlebars.compile(fileContents.toString());
        let result = template(data);
        console.log(writeName + " generated");
        fs.writeFileSync(writeName, result);
      }
    });
  };
  readAllFiles(dirname, mkDir);
};
