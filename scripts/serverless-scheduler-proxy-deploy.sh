 #!/bin/sh

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
REGION=$5

echo "Deploying proxy to project $PROJECT_ID, with bucket: $BUCKET, key location $KEY_LOCATION, key ring $KEY_RING and region $REGION"

gcloud beta run deploy \
            --image "gcr.io/$PROJECT_ID/serverless-scheduler-proxy" \
            --set-env-vars "PROJECT_ID=$PROJECT_ID,BUCKET_NAME=$BUCKET,KEY_LOCATION=$KEY_LOCATION,KEY_RING=$KEY_RING" \
            --platform managed \
            --region $REGION \
            --quiet \
            serverless-scheduler-proxy
