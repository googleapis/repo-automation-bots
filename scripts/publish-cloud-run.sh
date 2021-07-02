#!/bin/bash
# Copyright 2021 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

set -eo pipefail

if [ $# -lt 6 ]; then
  echo "Usage: $0 <botDirectory> <projectId> <bucket> <keyLocation> <keyRing> <region> [botName] [timeout] [min-instance]"
  exit 1
fi

directoryName=$1
project=$2
bucket=$3
keyLocation=$4
keyRing=$5
region=$6

botName=$(echo "${directoryName}" | rev | cut -d/ -f1 | rev)
if [ $# -ge 7 ]; then
  botName=$7
fi

if [ $# -ge 8 ]; then
  timeout=$8
else
  timeout="3600"
fi

if [ $# -ge 9 ]; then
  minInstances=$9
else
  minInstances="0"
fi

pushd "${directoryName}"
serviceName=${botName//_/-}
functionName=${botName//-/_}
queueName=${botName//_/-}

echo "About to cloud run app ${serviceName}"
gcloud beta run deploy \
  --image "gcr.io/${project}/${botName}" \
  --set-env-vars "DRIFT_PRO_BUCKET=${bucket}" \
  --set-env-vars "KEY_LOCATION=${keyLocation}" \
  --set-env-vars "KEY_RING=${keyRing}" \
  --set-env-vars "GCF_SHORT_FUNCTION_NAME=${functionName}" \
  --set-env-vars "PROJECT_ID=${project}" \
  --set-env-vars "GCF_LOCATION=${region}" \
  --set-env-vars "PUPPETEER_SKIP_CHROMIUM_DOWNLOAD='1'" \
  --set-env-vars "WEBHOOK_TMP=tmp-webhook-payloads" \
  --platform managed \
  --region "${region}" \
  --timeout "${timeout}" \
  --min-instances "${minInstances}" \
  --quiet \
  "${serviceName}"

echo "Adding ability for allUsers to execute the Function"
gcloud run services add-iam-policy-binding "${serviceName}" \
  --member="allUsers" \
  --region "${region}" \
  --role="roles/run.invoker"

echo "Deploying Queue ${queueName}"

verb="create"
if gcloud tasks queues describe "${queueName}"  &>/dev/null; then
  verb="update"
fi

gcloud tasks queues ${verb} "${queueName}" \
  --max-concurrent-dispatches="2048" \
  --max-attempts="100" \
  --max-retry-duration="43200s" \
  --max-dispatches-per-second="500" \
  --min-backoff="5s"
