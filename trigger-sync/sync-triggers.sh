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

# This script ensures that a Cloud Build trigger exists for each non-root
# cloudbuild.yaml file. Each is triggered on a push to master for any file
# changed in the directory containing that cloudbuild.yaml file.

set -eo pipefail

if [[ $# -lt 1 ]]
then
  echo "Usage: $0 <substitutions>"
  exit 1
fi

# propagate substitution variables to deploy triggers
SUBSTITUTIONS=$1

if [ -z "${PROJECT_ID}" ]
then
  echo "Need to set PROJECT_ID environment variable"
  exit 1
fi

if [ -z "${BRANCH_NAME}" ]
then
  BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
fi

if [ -z "${REPO_NAME}" ]
then
  echo "Need to set REPO_NAME environment variable"
  exit 1
fi

if [ -z "${REPO_OWNER}" ]
then
  REMOTE=$(git config --get remote.origin.url)
  REMOTE_REGEX="^(https|git)(:\/\/|@)([^\/:]+)[\/:]([^\/:]+)\/(.+).git$"
  if [[ ${REMOTE} =~ ${REMOTE_REGEX} ]]; then
    REPO_OWNER=${BASH_REMATCH[4]}
  else
    echo "Need to set REPO_OWNER environment variable"
  fi
fi

# find all non-root cloudbuild.yaml configs
for config in $(find -- */ -name 'cloudbuild.yaml' | sort -u)
do
  directory=$(dirname "${config}")
  triggerShortName=$(dirname "${config}" | rev | cut -d/ -f1 | rev)
  triggerName=$(dirname "${config}" | sed 's/\//-/g')

  echo "Checking for ${triggerName}"

  # test to see if the deployment trigger already exists
  if gcloud beta builds triggers describe "${triggerName}" --project="${PROJECT_ID}" &>/dev/null
  then
    # trigger already exists, skip
    continue
  fi

  echo "Syncing trigger for ${triggerShortName}"

  # create the trigger
  gcloud beta builds triggers create github \
    --project="${PROJECT_ID}" \
    --repo-name="${REPO_NAME}" \
    --repo-owner="${REPO_OWNER}" \
    --description="Trigger ${triggerShortName}" \
    --included-files="${directory}/**" \
    --name="${triggerName}" \
    --branch-pattern="^${BRANCH_NAME}$" \
    --build-config="${config}" \
    --substitutions="${SUBSTITUTIONS},_DIRECTORY=${directory}"

  # trigger the first deployment
  gcloud beta builds triggers run "${triggerName}" \
    --project="${PROJECT_ID}" \
    --branch="${BRANCH_NAME}"
done
