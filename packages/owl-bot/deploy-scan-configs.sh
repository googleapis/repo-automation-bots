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

gcloud run deploy \
    --image=gcr.io/repo-automation-bots/owlbot-cli-mono-repo-test \
    --platform=managed \
    --concurrency=1 \
    --ingress=all \
    --max-instances=1 \
    --min-instances=0 \
    --port=8080 \
    --service-account=owlbot-scan-configs@repo-automation-bots.iam.gserviceaccount.com \
    --timeout=59m \
    --update-secrets=TODO \
    --args=TODO \
    --allow-unauthenticated





