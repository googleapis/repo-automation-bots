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

# build and deploy the dashboard from a fresh clone

set -eo pipefail  # fail-fast and don't mask errors

# check token was passed in args
if [[ $# -ne 1 ]]
then
  echo "Usage $0 <path-to-token-file>"
  exit 1
fi

# compile
npm install
npm run compile

# deploy to Firebase
firebase deploy --token "$(cat $1)"