import express from 'express';
import {DataProcessorFactory} from './data-processor-factory';

export enum Task {
  ProcessLogs = 'Process Logs Data',
  ProcessTaskQueue = 'Process Task Queue Data',
  ProcessGCF = 'Process Cloud Functions Data',
  ProcessGitHub = 'Process GitHub Data'
}

async function handleTask(task: Task, req: express.Request, res: express.Response) {
  try {
    const dataProcessor = DataProcessorFactory.getDataProcessor(task);
    await dataProcessor.collectAndProcess();
    res.status(200).send(`Successfully completed task: ${task}`)
  } catch (err) {
    res.status(500).send(`Error while completing task: ${task}.`)
  }
}

const app = express();
const ROOT = '/task';

app.get(`${ROOT}/process-logs`, (req, res) =>
  handleTask(Task.ProcessLogs, req, res)
);
app.get(`${ROOT}/process-task-queue`, (req, res) =>
  handleTask(Task.ProcessTaskQueue, req, res)
);
app.get(`${ROOT}/process-gcf`, (req, res) =>
  handleTask(Task.ProcessGCF, req, res)
);
app.get(`${ROOT}/process-github`, (req, res) =>
  handleTask(Task.ProcessGitHub, req, res)
);

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log('Data Processor started. Now awaiting task requests.', port);
});
