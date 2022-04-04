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
# basically a simplified copy of scripts/publish-cloud-run.sh with
# addition of some env vars required for running owlbot. This script
# is called from packages-owlbot Cloud Build trigger which is invoked
# when changes in the owl-bot directory pushed to the main branch.

set -eo pipefail

if [ $# -lt 8 ]; then
  echo "Usage: $0 <botDirectory> <projectId> <bucket> <keyLocation> <keyRing> <region> <botName> <timeout>"
  exit 1
fi

directoryName=$1
project=$2
bucket=$3
keyLocation=$4
keyRing=$5
region=$6
botName=$7
timeout=$8
minInstances="0"

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
functionName=${botName//-/_}
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
