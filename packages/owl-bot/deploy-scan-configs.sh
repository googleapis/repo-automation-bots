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
set -e

# TODO: set --ingress=internal after tested and scheduler is set up.

gcloud beta run deploy owlbot-cli-mono-repo-test \
    --project repo-automation-bots \
    --image=gcr.io/repo-automation-bots/owlbot-cli-mono-repo-test:v3 \
    --platform=managed \
    --concurrency=1 \
    --memory=8Gi \
    --ingress=all \
    --max-instances=1 \
    --min-instances=0 \
    --port=8080 \
    --service-account=owlbot-scan-configs@repo-automation-bots.iam.gserviceaccount.com \
    --timeout=59m \
    --update-secrets=/secrets/github.pem=owlbot_github_key:latest \
    --args="scan-configs,--pem-path,/secrets/github.pem,--app-id,99011,--installation,14695777,--project,repo-automation-bots-metrics,--org,googleapis,--port,8080" \
    --allow-unauthenticated





