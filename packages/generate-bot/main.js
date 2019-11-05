const { prompt } = require("enquirer");
const Handlebars = require("handlebars");
const fs = require("fs");
const path = require("path");
const process = require("process");

exports.checkValidity = function(testString) {
  let isValid = true;
  const invalidChars = ["-", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  const string = JSON.stringify(testString);
  for (let i = 0; i < invalidChars.length; i++) {
    if (string.includes(invalidChars[i])) {
      isValid = false;
      console.log(
        "You used an invalid character, like a hyphen or an integer. Please try again."
      );
      break;
    }
  }

  if (isValid && !testString.programName) {
    isValid = false;
    console.log(
      "You forgot to name your program. Please try again."
    );
  }

 if (testString.programName && testString.programName.charAt(0) == testString.programName.charAt(0).toUpperCase()) {
        testString.programName = testString.programName.toLowerCase();
 }

 if (!testString.fileLocation) {
	testString.fileLocation = `../${testString.programName}`
}
 
  console.log(testString);
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
        message: `This package will be saved at /packages/yourProgramName unless you specify another location and name here relative to ${process.cwd()} : `
      }
    ]);

    isValid = exports.checkValidity(input);

};

  
  console.log(input);
  return input;
};

exports.creatingBotFiles = function(dirname, data) {
  fs.mkdirSync(`${data.fileLocation}`);
  console.log(`${data.fileLocation}` + " generated");

  const mkDir = `${data.fileLocation}`;

  const readAllFiles = function(dirNameRead, dirNameWrite) {
    const files = fs.readdirSync(dirNameRead);
    files.forEach(function(file) {
      const readName = path.join(dirNameRead, file);
      const writeName = path.join(dirNameWrite, file);
      if (fs.statSync(readName).isDirectory()) {
        fs.mkdirSync(writeName);
        console.log(writeName + " generated");
        readAllFiles(readName, writeName);
      } else {
        const fileContents = fs.readFileSync(readName);
        const template = Handlebars.compile(fileContents.toString());
        const result = template(data);
        console.log(writeName + " generated");
        fs.writeFileSync(writeName, result);
      }
    });
  };
  readAllFiles(dirname, mkDir);
};
