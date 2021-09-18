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

if [ $# -lt 8 ]; then
  echo "Usage: $0 <botDirectory> <projectId> <bucket> <keyLocation> <keyRing> <region> <botName> <service-account> [service-account] [timeout] [min-instance] [concurrency]"
  exit 1
fi

directoryName=$1
project=$2
bucket=$3
keyLocation=$4
keyRing=$5
region=$6
serviceNameForCloudRun=$7
serviceNameForInvoker=$8

botName=$(echo "${directoryName}" | rev | cut -d/ -f1 | rev)
if [ $# -ge 9 ]; then
  botName=$9
fi

if [ $# -ge 10 ]; then
  timeout=${10}
else
  timeout="3600"
fi

if [ $# -ge 11 ]; then
  minInstances=${11}
else
  minInstances="0"
fi

if [ $# -ge 12 ]; then
  concurrency=${12}
else
  concurrency="80"
fi

pushd "${directoryName}"
serviceName=${botName//_/-}

deployArgs=(
  "--image"
  "gcr.io/${project}/${botName}"
  "--set-env-vars"
  "DRIFT_PRO_BUCKET=${bucket}"
  "--set-env-vars"
  "KEY_LOCATION=${keyLocation}"
  "--set-env-vars"
  "KEY_RING=${keyRing}"
  "--set-env-vars"
  "PROJECT_ID=${project}"
  "--set-env-vars"
  "GCF_LOCATION=${region}"
  "--set-env-vars"
  "PUPPETEER_SKIP_CHROMIUM_DOWNLOAD='1'"
  "--set-env-vars"
  "WEBHOOK_TMP=${webhookTmpBucket}"
  "--set-env-vars"
  "BOT_RUNTIME=run"
  "--platform"
  "managed"
  "--region"
  "${region}"
  "--timeout"
  "${timeout}"
  "--min-instances"
  "${minInstances}"
  "--concurrency"
  "${concurrency}"
  "--service-account"
  "${serviceNameForCloudRun}"
  "--quiet"
)

echo "About to cloud run app ${serviceName}"
gcloud beta run deploy "${serviceName}" "${deployArgs[@]}"

echo "Adding ability for scheduler to execute the Function"
gcloud run services add-iam-policy-binding "${serviceName}" \
  --member="${serviceNameForInvoker}" \
  --region "${region}" \
  --role="roles/run.invoker"
