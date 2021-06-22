#!/bin/bash
# Copyright 2020 Google LLC
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
  echo "Usage: $0 <botDirectory> <projectId> <bucket> <keyLocation> <keyRing> <region>"
  exit 1
fi

directoryName=$1
project=$2
bucket=$3
keyLocation=$4
keyRing=$5
region=$6

botName=$(echo "${directoryName}" | rev | cut -d/ -f1 | rev)
workdir=$(pwd)

pushd "${directoryName}"
serviceName=${botName//_/-}
queueName=${botName//_/-}

echo "About to cloud run app ${serviceName}"
gcloud run deploy \
  --image "gcr.io/${project}/${botName}" \
  --set-env-vars "DRIFT_PRO_BUCKET=${bucket}" \
  --set-env-vars "KEY_LOCATION=${keyLocation}" \
  --set-env-vars "KEY_RING=${keyRing}" \
  --set-env-vars "GCF_SHORT_FUNCTION_NAME=${serviceName}" \
  --set-env-vars "PROJECT_ID=${project}" \
  --set-env-vars "GCF_LOCATION=${functionRegion}" \
  --set-env-vars "PUPPETEER_SKIP_CHROMIUM_DOWNLOAD='1'" \
  --set-env-vars "WEBHOOK_TMP=tmp-webhook-payloads" \
  --platform managed \
  --region "${region}" \
  --quiet \
  "${serviceName}"

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
