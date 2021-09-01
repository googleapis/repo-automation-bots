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
#  3. Change to --ingress=internal
#  4. Change to --schedule="0 */12 * * *"

# I see no need to make updating scan-configs automatically.  It will rarely
# change, and when that happens, a user can manually re-run this script.

set -ex

# TODO: set --ingress=internal after tested and scheduler is set up.

gcloud beta run deploy owlbot-cli-mono-repo-test \
    --project repo-automation-bots \
    --image=gcr.io/repo-automation-bots/owlbot-cli-mono-repo-test:v4 \
    --platform=managed \
    --concurrency=1 \
    --memory=4Gi \
    --ingress=all \
    --max-instances=1 \
    --min-instances=0 \
    --port=8080 \
    --service-account=owlbot-scan-configs@repo-automation-bots.iam.gserviceaccount.com \
    --timeout=59m \
    --update-secrets=/secrets/github.pem=owlbot_github_key:latest \
    --args="scan-configs,--pem-path,/secrets/github.pem,--app-id,99011,--installation,14695777,--project,repo-automation-bots-metrics,--org,googleapis,--port,8080" \
    --allow-unauthenticated

URL=$(gcloud run services list \
    --project repo-automation-bots \
    --platform managed \
    --format 'value(status.url)' \
    --filter 'owlbot-cli-mono-repo-test')

gcloud scheduler jobs create http invoke-owlbot-cli-mono-repo-test \
    --project repo-automation-bots \
    --schedule="02 10 * * *" \
    --uri="${URL}/scan-configs" \
    --http-method=GET \
    --attempt-deadline=30m \
    --time-zone=America/Los_Angeles

