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

# compile the specified npm package and stage it in into target/<botname>

set -eo pipefail

if [[ $# -ne 1 ]]
then
  echo "Usage $0 <botDirectory>"
  exit 1
fi

directoryName=$1
botName=$(echo ${directoryName} | rev | cut -d/ -f1 | rev)

workdir=$(pwd)
targetDir="${workdir}/targets/${botName}"
mkdir -p ${targetDir}

pushd ${directoryName}

# compile
npm install -g typescript
npm install
npm run compile
cp -r build ${targetDir}
cp package.json "${targetDir}/package.json"

popd