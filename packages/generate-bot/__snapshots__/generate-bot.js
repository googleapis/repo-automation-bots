exports["file structure checks that the file content carries over 1"] = `
Start of snapshot: helloWorld

Usage
# TODO: Fill out section

Setup
# Install dependencies
npm install

# Run the bot
npm start
Testing
This bot uses nock for mocking requests to GitHub, and snap-shot-it for capturing responses; This allows updates to the API surface to be treated as a visual diff, rather than tediously asserting against each field.

Running tests:

npm run test
To update snapshots:

npm run test:snap
Contributing
If you have suggestions for how helloWorld could be improved, or want to report a bug, open an issue! We'd love all and any contributions.

For more, check out the Contributing Guide.

License
Apache 2.0 © 2019 Google Inc.  
{
  "name": "helloWorld",
  "version": "1.1.0",
  "description": "says hi",
  "private": true,
  "author": "Google Inc.",
  "license": "Apache-2.0",
  "repository": "https://github.com/googleapis/repo-automation-bots.git",
  "homepage": "https://github.com/googleapis/repo-automation-bots",
  "bugs": "https://github.com/googleapis/repo-automation-bots/issues",
  "main": "build/src/app.js",
  "keywords": [
    "probot",
    "github",
    "probot-app"
  ],
  "scripts": {
    "compile": "tsc -p .",
    "start": "probot run ./build/src/helloWorld.js",
    "start:local": "node ./build/src/local.js",
    "prepare": "npm run compile",
    "pretest": "npm run compile",
    "test": "cross-env LOG_LEVEL=fatal mocha --timeout=15000 --recursive ./build/test",
    "test:snap": "SNAPSHOT_UPDATE=1 npm test",
    "fix": "gts fix",
    "lint": "gts check"
  },
  "dependencies": {
    "gcf-utils": "1.1.0",
    "probot": "9.6.4"
  },
  "devDependencies": {
    "@types/body-parser": "^1.17.0",
    "@types/bunyan": "^1.8.6",
    "@types/chai": "^4.1.7",
    "@types/dotenv": "^6.1.1",
    "@types/express": "^4.17.0",
    "@types/ioredis": "^4.0.13",
    "@types/lru-cache": "^5.1.0",
    "@types/mocha": "^5.2.7",
    "@types/nock": "^10.0.3",
    "@types/node": "^12.6.1",
    "body-parser": "^1.19.0",
    "chai": "^4.2.0",
    "cross-env": "^6.0.0",
    "dotenv": "^8.0.0",
    "gts": "^1.0.0",
    "mocha": "^6.1.4",
    "nock": "^11.0.0",
    "smee-client": "^1.1.0",
    "snap-shot-it": "^7.8.0",
    "typescript": "^3.5.3"
  },
  "engines": {
    "node": ">= 10.13.0"
  }
} 
{
  "extends": "gts/tsconfig-google",
  "compilerOptions": {
    "esModuleInterop": true,
    "rootDir": ".",
    "outDir": "build"
  },
  "include": [
    "src/*.ts",
    "src/**/*.ts",
    "test/*.ts",
    "test/**/*.ts",
    "system-test/*.ts"
  ]
}

`;
