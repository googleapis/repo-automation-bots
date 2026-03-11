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

set -e
set -o pipefail

if [ $# -ne 4 ]; then
    echo "Wrong number of arguments passed" && exit 1
fi

PROJECT_ID=$1
BUCKET=$2
KEY_LOCATION=$3
KEY_RING=$4

cd "packages" || exit 1
for f in *; do
    # Skip symlinks and our gcf-utils/generate-bot directory as it is not a function
    if [[ -d "$f" && ! -L "$f" && "$f" != "gcf-utils" && "$f" != "generate-bot" && "$f" != "monitoring-system" && "$f" != "slo-stat-bot" ]]; then
         # Subshell to avoid having to cd back
        (
        cd "$f" || exit 1
        echo "$f"
        functionname=${f//-/_}

        tmp_dir=$(mktemp -d -t k-XXXXXXXXXX)

        cipher="${tmp_dir}/${functionname}"
        plain="${tmp_dir}/${functionname}.plain"

        # Download the blob
        gcloud storage cp "gs://${BUCKET}/${functionname}" "${cipher}"

        # Decrypt the Blob
        gcloud kms decrypt --project="${PROJECT_ID}" --keyring="${KEY_RING}" --location="${KEY_LOCATION}" --ciphertext-file="${cipher}" --plaintext-file="${plain}" --key="${functionname}"

        # Make the secret
        gcloud secrets create "${functionname}" --replication-policy="automatic" --data-file=- < "${plain}"

        # Clean up
        echo "${tmp_dir}"
        rm -r "${tmp_dir}"
        )
    fi
done