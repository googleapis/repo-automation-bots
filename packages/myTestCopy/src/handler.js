const { serverless } = require('@probot/serverless-gcf')
const appFn = require('./myTestCopy')
module.exports.probot = serverless(appFn)