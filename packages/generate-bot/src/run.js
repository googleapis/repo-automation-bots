const GenerateBot = require("./main.js");

async function prompt() {
  GenerateBot.creatingBotFiles(
    "./templates",
    await GenerateBot.collectUserInput()
  );
}

prompt();
