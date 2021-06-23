#!/bin/bash

# Copyright 2019 Google LLC
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

set -e
set -o pipefail

if [ $# -ne 4 ]; then
    echo "Wrong number of arguments passed" && exit 1
fi

SCHEDULER_SERVICE_ACCOUNT_EMAIL=$1
FUNCTION_REGION=$2
REGION=$3
DIRECTORY=$4

npm i -g @google-automations/cron-utils

pushd "${DIRECTORY}"
FUNCTION_NAME=$(echo "${DIRECTORY}" | rev | cut -d/ -f1 | rev | tr '-' '_')

cron-utils deploy \
  --scheduler-service-account="$SCHEDULER_SERVICE_ACCOUNT_EMAIL" \
  --function-region="$FUNCTION_REGION" \
  --region="${REGION}" \
  --function-name="${FUNCTION_NAME}"
