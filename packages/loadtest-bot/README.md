# loadtest-bot

This bot does nothing. It only exists for performing load test.

## Deployment

To deploy to our staging environment, set the `project` config for gcloud.

```bash
$ gcloud config set project repo-automation-bots-staging
```

From the project top level directory, submit a Cloud Build job.

```bash
$ gcloud builds submit . \
  --config packages/loadtest-bot/cloudbuild-staging.yaml \
  --substitutions="_FUNCTION_REGION=us-central1,_DIRECTORY=packages/loadtest-bot,_BUCKET=repo-bots-tokens,_KEY_RING=probot-keys,_KEY_LOCATION=us-central1"
```

## Loadtest

Install `loadtest` package.

```bash
$ npm i -g loadtest
```

Perform loadtest with the fixture:

```bash
loadtest -n 100000 -c 200 --timeout 10000 -T "application/json" \
  -H "X-GitHub-Event: pull_request" \
  -H "X-GitHub-Delivery: 6d68cb60-dacc-11eb-8528-b229fa7da8b2" \
  -H "X-Hub-Signature:sha1=e531beb2c6b79d7c651998c2f5d1b8bdbbc1fc01" \
  --data "$(cat test/fixtures/body.json)" \
  -m POST \
  ${BOT_URL}
```
