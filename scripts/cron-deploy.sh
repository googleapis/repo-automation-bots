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

# Get the endpoint for serverless-scheduler-proxy
proxyurl=$(gcloud beta run services describe serverless-scheduler-proxy \
    --platform managed \
    --region "$REGION" \
    --format="value(status.address.url)")

pushd "${DIRECTORY}"
functionname=$(echo "${DIRECTORY}" | rev | cut -d/ -f1 | rev)
schedule=$(cat "cron")
if gcloud beta scheduler jobs describe "$functionname" 2>/dev/null; then
    # We have an existing job. Update the schedule
    gcloud beta scheduler jobs update http "$functionname" --schedule "$schedule" \
            --uri="$proxyurl/v0"
    else
    # Make a cloud scheduler job
    gcloud beta scheduler jobs create http "$functionname" \
            --schedule "$schedule" \
            --http-method=POST \
            --uri="$proxyurl/v0" \
            --oidc-service-account-email="$SCHEDULER_SERVICE_ACCOUNT_EMAIL" \
            --oidc-token-audience="$proxyurl" \
            --message-body="{\"Name\": \"$functionname\", \"Type\" : \"function\", \"Location\": \"$FUNCTION_REGION\"}" \
            --headers=Content-Type=application/json
fi
popd