# serverless-scheduler-proxy

This application acts as a springboard to the bots running in Cloud Functions
from Cloud Scheduler

## Pre Reqs

By default, Cloud Run instances are deployed within your Project's VPC, and
service accounts in the project must be given the `run.invoker` role in order
to actually hit the endpoint. If they are not, Cloud IAM will prevent the request
from hitting the application.

1. A Google Cloud Service Account that can invoke Cloud Run

```bash
gcloud iam service-accounts create serverless-proxy-cron \
   --display-name "Serverless Scheduler Proxy Cron"
```

1. A role or binding to the Service Account

```bash
gcloud beta run services add-iam-policy-binding serverless-scheduler-proxy \
   --region=REGION
   --member=serviceAccount:serverless-proxy-cron@PROJECT-ID.iam.gserviceaccount.com \
   --role=roles/run.invoker
```

1. An AppEngine app to host the scheduler in.

```bash
gcloud app create --region=REGION
```
