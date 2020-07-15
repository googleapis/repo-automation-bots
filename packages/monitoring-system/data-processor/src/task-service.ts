import express from 'express';

export enum Task {
  ProcessLogs,
  ProcessTaskQueue,
  ProcessGCF,
  ProcessGitHub,
}

function processLogs(req: express.Request, res: express.Response) {
  res.send('Process Logs: not implemented');
}

function processTaskQueue(req: express.Request, res: express.Response) {
  res.send('Process Task Queue: not implemented');
}

function processGCF(req: express.Request, res: express.Response) {
  res.send('Process GCF: not implemented');
}

function processGitHub(req: express.Request, res: express.Response) {
  res.send('Process GitHub: not implemented');
}

const app = express();
const ROOT_TASK_ENDPOINT = '/task';

app.get(`${ROOT_TASK_ENDPOINT}/process-logs`, processLogs);
app.get(`${ROOT_TASK_ENDPOINT}/process-task-queue`, processTaskQueue);
app.get(`${ROOT_TASK_ENDPOINT}/process-gcf`, processGCF);
app.get(`${ROOT_TASK_ENDPOINT}/process-github`, processGitHub);

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log('Data Processor started. Now awaiting task requests.', port);
});
