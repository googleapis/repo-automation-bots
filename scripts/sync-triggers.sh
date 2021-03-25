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

# This script ensures that a Cloud Build trigger exists for each non-root
# cloudbuild.yaml file. Each is triggered on a push to master for any file
# changed in the directory containing that cloudbuild.yaml file.

set -eo pipefail

if [[ $# -ne 6 ]]
then
  echo "Usage: $0 <project> <bucket> <functionRegion> <keyRing> <region> <schedulerServiceAccountEmail>"
  exit 1
fi

project=$1
bucket=$2
functionRegion=$3
keyRing=$4
region=$5
schedulerServiceAccountEmail=$6

# change this configuration for testing
branch="master"
repoOwner="googleapis"
repoName="repo-automation-bots"

# propagate substitution variables to deploy triggers
substitutions="_BUCKET=${bucket},_FUNCTION_REGION=${functionRegion},_KEY_RING=${keyRing},_REGION=${region},_SCHEDULER_SERVICE_ACCOUNT_EMAIL=${schedulerServiceAccountEmail}"

# find all non-root cloudbuild.yaml configs
for config in $(find -- */ -name 'cloudbuild.yaml' | sort -u)
do
  directory=$(dirname "${config}")
  botName=$(dirname "${config}" | rev | cut -d/ -f1 | rev)
  triggerName=$(dirname "${config}" | sed 's/\//-/g')

  # test to see if the deployment trigger already exists
  if gcloud beta builds triggers describe "${triggerName}" --project="${project}" &>/dev/null
  then
    # trigger already exists, skip
    continue
  fi

  echo "Syncing trigger for ${botName}"

  # create the trigger
  gcloud beta builds triggers create github \
    --project="${project}" \
    --repo-name="${repoName}" \
    --repo-owner="${repoOwner}" \
    --description="Deploy ${botName}" \
    --included-files="${directory}/**" \
    --name="${triggerName}" \
    --branch-pattern="^${branch}$" \
    --build-config="${config}" \
    --substitutions="${substitutions},_DIRECTORY=${directory}"

  # trigger the first deployment
  gcloud beta builds triggers run "${triggerName}" \
    --project="${project}" \
    --branch="${branch}"
done
