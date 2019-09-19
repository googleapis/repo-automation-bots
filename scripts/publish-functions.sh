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

# For each item in our packages directory run
#   gcloud functions deploy
# Then copy the tar out to our "targets" directory for further unpacking
workdir=$(pwd)
echo "$workdir"
targets=$workdir/targets
mkdir -p "$targets"
echo "$targets"
cd packages || exit 1
for f in *; do
    # Skip symlinks and our gcf-utils directory as it is not a function
    if [[ -d "$f" && ! -L "$f" && "$f" != "gcf-utils" ]]; then
        # Subshell to avoid having to cd back
        (
        cd "$f" || exit 1
        echo "$f"
        # Javascript does not allow function names with '-' so we need to
        # replace the directory name (which might have '-') with "_"
        functionname=${f//-/_}
        gcloud functions deploy "$functionname" --trigger-http \
            --runtime nodejs10 \
            --region "$_FUNCTION_REGION" \
            --set-env-vars DRIFT_PRO_BUCKET="$_BUCKET",KEY_LOCATION="$_KEY_LOCATION",KEY_RING="$_KEY_RING",GCF_SHORT_FUNCTION_NAME="$functionname",PROJECT_ID="$PROJECT_ID"
        )
    fi
done