#!/bin/bash
# Copyright 2022 Google LLC
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

# This script is for publishing owlbot backend to Cloud Run. It is
# basically a copy of scripts/publish-cloud-run.sh with addition of
# some env vars required for running owlbot.

set -eo pipefail

if [ $# -lt 6 ]; then
  echo "Usage: $0 <botDirectory> <projectId> <bucket> <keyLocation> <keyRing> <region> [botName] [timeout] [min-instance] [concurrency]"
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

if [ -z "${CONCURRENCY}" ]; then
  if [ $# -ge 10 ]; then
    CONCURRENCY=${10}
  else
    CONCURRENCY="80"
  fi
fi

if [ "${project}" == "repo-automation-bots" ]; then
    webhookTmpBucket=tmp-webhook-payloads
elif [ "${project}" == "repo-automation-bots-staging" ]; then
    webhookTmpBucket=tmp-webhook-payloads-staging
else
    echo "deploying to '${project}' is not supported"
    exit 1
fi

if [ -z "${SERVICE_NAME}" ]; then
  SERVICE_NAME=${botName//_/-}
fi

if [ -z "${IMAGE_NAME}" ]; then
  IMAGE_NAME="gcr.io/${project}/${botName}"
fi

pushd "${directoryName}"
functionName=${botName//-/_}q
ueueName=${botName//_/-}

deployArgs=(
  "--image"
  "${IMAGE_NAME}"
  "--set-env-vars"
  "DRIFT_PRO_BUCKET=${bucket}"
  "--set-env-vars"
  "KEY_LOCATION=${keyLocation}"
  "--set-env-vars"
  "KEY_RING=${keyRing}"
  "--set-env-vars"
  "GCF_SHORT_FUNCTION_NAME=${functionName}"
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
  "--set-env-vars"
  "APP_ID=${APP_ID}"
  "--set-env-vars"
  "CLOUD_BUILD_TRIGGER=${CLOUD_BUILD_TRIGGER}"
  "--set-env-vars"
  "CLOUD_BUILD_TRIGGER_REGENERATE_PULL_REQUEST=${CLOUD_BUILD_TRIGGER_REGENERATE_PULL_REQUEST}"
  "--set-env-vars"
  "FIRESTORE_PROJECT_ID=${FIRESTORE_PROJECT_ID}"
  "--set-env-vars"
  "UPDATE_LOCK_BUILD_TRIGGER_ID=${UPDATE_LOCK_BUILD_TRIGGER_ID}"
  "--platform"
  "managed"
  "--region"
  "${region}"
  "--timeout"
  "${timeout}"
  "--min-instances"
  "${minInstances}"
  "--concurrency"
  "${CONCURRENCY}"
  "--quiet"
)
if [ -n "${SERVICE_ACCOUNT}" ]; then
  deployArgs+=( "--service-account" "${SERVICE_ACCOUNT}" )
fi
if [ -n "${MEMORY}" ]; then
  deployArgs+=( "--memory" "${MEMORY}" )
fi
echo "About to deploy cloud run app ${SERVICE_NAME}"
gcloud run deploy "${SERVICE_NAME}" "${deployArgs[@]}"

echo "Adding ability for allUsers to execute the Function"
gcloud run services add-iam-policy-binding "${SERVICE_NAME}" \
  --member="allUsers" \
  --region "${region}" \
  --role="roles/run.invoker"
