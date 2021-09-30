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

directoryName='secret-rotator'
botName='secret-rotator'
imageProject=$1
project=$1
region='us-central1'
serviceNameForCloudRun=$2
serviceNameForInvoker=$3
timeout=3600
concurrency=80

pushd "packages/${directoryName}"
serviceName=${botName//_/-}

deployArgs=(
  "--project"
  "${project}"
  "--image"
  "gcr.io/${imageProject}/${botName}"
  "--platform"
  "managed"
  "--region"
  "${region}"
  "--timeout"
  "${timeout}"
  "--concurrency"
  "${concurrency}"
  "--service-account"
  "${serviceNameForCloudRun}"
  "--quiet"
  "--project"
  "${project}"
)

echo "About to cloud run app ${serviceName}"
gcloud beta run deploy "${serviceName}" "${deployArgs[@]}"

echo "Adding ability for scheduler to execute the Function"
gcloud run services add-iam-policy-binding "${serviceName}" \
  --project="${project}" \
  --member="${serviceNameForInvoker}" \
  --region "${region}" \
  --role="roles/run.invoker"
