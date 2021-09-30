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

set -ex

gcloud run deploy owlbot-retry-builds \
    --project repo-automation-bots \
    --image=gcr.io/repo-automation-bots/owlbot-cli \
    --platform=managed \
    --concurrency=1 \
    --memory=4Gi \
    --ingress=all \
    --no-allow-unauthenticated \
    --max-instances=1 \
    --min-instances=0 \
    --port=8080 \
    --service-account=owlbot-retry-builds@repo-automation-bots.iam.gserviceaccount.com \
    --timeout=30m \
    --args="scan-and-retry-failed-lock-updates,--port,8080"


# Run the job once per hour.

URL=$(gcloud run services list \
    --project repo-automation-bots \
    --platform managed \
    --format 'value(status.url)' \
    --filter 'owlbot-retry-builds')

gcloud scheduler jobs create http invoke-owlbot-retry-builds \
    --project repo-automation-bots \
    --schedule="33 * * * *" \
    --uri="${URL}/rebuild" \
    --http-method=GET \
    --attempt-deadline=30m \
    --time-zone=America/Los_Angeles \
    --oidc-service-account-email 856896688174-compute@developer.gserviceaccount.com    