import express from 'express';
const app = express();

let ROOT_TASK_ENDPOINT = '/task';

app.get(`${ROOT_TASK_ENDPOINT}/process-logs`, processLogs);
app.get(`${ROOT_TASK_ENDPOINT}/process-logs`, processLogs);

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log('Hello world listening on port', port);
});

function processLogs(req, res) {
    // TODO
    throw new Error("Not implemented");
}

function processTaskQueue(req, res) {
    // TODO
    throw new Error("Not implemented");
}

function processGCF(req, res) {
    // TODO
    throw new Error("Not implemented");
}

function processGitHub(req, res) {
    // TODO
    throw new Error("Not implemented");
}