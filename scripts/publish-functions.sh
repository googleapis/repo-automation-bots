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

if [ $# -ne 5 ]; then
    echo "Wrong number of arguments passed" && exit 1
fi

PROJECT_ID=$1
BUCKET=$2
KEY_LOCATION=$3
KEY_RING=$4
FUNCTION_REGION=$5

deploy_queue(){
    local queue=$1

    VERB="create"
    if gcloud tasks queues describe $queue  &>/dev/null; then
        VERB="update"
    fi

    gcloud tasks queues $VERB $queue \
    --max-concurrent-dispatches="2048" \
    --max-attempts="100" \
    --max-dispatches-per-second="2048"    
}

# For each item in our packages directory run
#   gcloud functions deploy
# Then copy the tar out to our "targets" directory for further unpacking
workdir=$(pwd)
echo "$workdir"
targets=$workdir/targets
mkdir -p "$targets"
echo "$targets"
cd "$targets" || exit 1
for f in *; do
    # Skip symlinks and our gcf-utils/generate-bot directory as it is not a function
    if [[ -d "$f" && ! -L "$f" && "$f" != "gcf-utils" && "$f" != "generate-bot" ]]; then
        # Subshell to avoid having to cd back
        (
        cd "$f" || exit 1
        echo "$f"
        # Javascript does not allow function names with '-' so we need to
        # replace the directory name (which might have '-') with "_"
        functionname=${f//-/_}
        echo "About to publish function $functionname"

        gcloud functions deploy "$functionname" --trigger-http \
            --runtime nodejs10 \
            --region "$FUNCTION_REGION" \
            --set-env-vars DRIFT_PRO_BUCKET="$BUCKET",KEY_LOCATION="$KEY_LOCATION",KEY_RING="$KEY_RING",GCF_SHORT_FUNCTION_NAME="$functionname",PROJECT_ID="$PROJECT_ID",GCF_LOCATION="$FUNCTION_REGION"
        )

        deploy_queue($functionname)
    fi
done