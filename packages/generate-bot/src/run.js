const GenerateBot = require("./main.js");
const path = require("path");
const process = require("process");

let relativePath = path.resolve(__dirname, '../templates');
async function prompt() {
  GenerateBot.creatingBotFiles(
    relativePath,
    await GenerateBot.collectUserInput()
  );
}

prompt();
