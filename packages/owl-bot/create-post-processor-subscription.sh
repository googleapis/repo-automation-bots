#!/bin/bash

# Copyright 2020 Google LLC
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

# Create a subscription to listen to docker images being published to the GCP
# project cloud-devrel-public-resources.  When a new post processor is published,
# owl-bot updates all the libraries that depend on the that post processor.

gcloud pubsub subscriptions create \
    owl-bot-container-build-cloud-devrel-public-resources \
    --project repo-automation-bots \
    --topic projects/repo-automation-bots/topics/gcr \
    --ack-deadline 300 \
    --push-auth-service-account \
        serverless-proxy-cron@repo-automation-bots.iam.gserviceaccount.com \
    --push-endpoint https://serverless-scheduler-proxy-c7mcaca6sa-uc.a.run.app/v0/container

