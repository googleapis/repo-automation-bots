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

# This script will be used to bootstrap the scan-configs process.
# It's presently set up with test values.  After the source is merged,
# values will be updated for production:
#  1. Change the name of the deployment to owlbot-cli-scan-configs
#  2. Change to --image=gcr.io/repo-automation-bots/owlbot-cli:latest

# I see no need to make updating scan-configs automatically.  It will rarely
# change, and when that happens, a user can manually re-run this script.

set -ex

gcloud beta run deploy owlbot-scan-configs \
    --project repo-automation-bots \
    --image=gcr.io/repo-automation-bots/owlbot-cli \
    --platform=managed \
    --concurrency=1 \
    --memory=4Gi \
    --ingress=all \
    --max-instances=1 \
    --min-instances=0 \
    --region us-central1 \
    --port=8080 \
    --service-account=owlbot-scan-configs@repo-automation-bots.iam.gserviceaccount.com \
    --timeout=59m \
    --update-secrets=/secrets/github.pem=owlbot_github_key:latest \
    --args="scan-configs,--pem-path,/secrets/github.pem,--app-id,99011,--installation,14695777,--project,repo-automation-bots-metrics,--org,googleapis,--port,8080"

URL=$(gcloud run services list \
    --project repo-automation-bots \
    --platform managed \
    --format 'value(status.url)' \
    --filter 'owlbot-scan-configs')

gcloud scheduler jobs create http invoke-owlbot-scan-configs \
    --project repo-automation-bots \
    --schedule="5 5 * * *" \
    --uri="${URL}/scan-configs" \
    --http-method=GET \
    --attempt-deadline=30m \
    --time-zone=America/Los_Angeles \
    --oidc-service-account-email 856896688174-compute@developer.gserviceaccount.com

