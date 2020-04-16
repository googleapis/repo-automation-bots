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

if [ $# -ne 1 ]; then
    echo "Wrong number of arguments passed" && exit 1
fi

PROJECT_ID=$1

(
    #Subshell to avoid having to cd ..
    cd serverless-scheduler-proxy || exit 1
    docker build -t gcr.io/"${PROJECT_ID}"/serverless-scheduler-proxy .
    docker push gcr.io/"${PROJECT_ID}"/serverless-scheduler-proxy
)