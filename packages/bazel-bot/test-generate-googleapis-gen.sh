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
set -e

generate_googleapis_gen=$(realpath docker-image/generate-googleapis-gen.sh)
TEST_WORKDIR=`realpath test-workdir`
mkdir -p "$TEST_WORKDIR"
pushd . 
echo "Working in $TEST_WORKDIR"
cd "$TEST_WORKDIR"

# Clone googleapis
if [ ! -d "googleapis" ] ; then
    set +e  # Git clone returns an error code because config user.email is not set.
    # There's no way to set it for the repo and clone it at the same time.  :-/
    git clone https://github.com/googleapis/googleapis
    set -e
    git -C googleapis config user.email "test@example.com"
    git -C googleapis config user.name "Testy McTestFace"
fi
git -C googleapis checkout master

# Select the sha for HEAD~2
sha=$(git -C googleapis log -3 --format=%H | tail -1)

# Create a fake googleapis-gen with the sha tag.
rm -rf googleapis-gen googleapis-gen-clone
mkdir googleapis-gen
git -C googleapis-gen init --initial-branch=main
git -C googleapis-gen config user.email "test@example.com"
git -C googleapis-gen config user.name "Testy McTestFace"
echo hello > googleapis-gen/hello.txt
git -C googleapis-gen add -A
git -C googleapis-gen commit -m "Hello world."
git -C googleapis-gen tag "googleapis-$sha"

# Clone googleapis-gen so git push pushes back to local copy.
set +e
git clone googleapis-gen googleapis-gen-clone -b main
set -e
git -C googleapis-gen-clone config user.email "test@example.com"
git -C googleapis-gen-clone config user.name "Testy McTestFace"
git -C googleapis-gen checkout -b other

# Test!
export GOOGLEAPIS_GEN=`realpath googleapis-gen-clone`
export INSTALL_CREDENTIALS="echo 'Pretending to install credentials...''"
export BUILD_TARGETS=//google/cloud/vision/v1:vision-v1-nodejs.tar.gz
bash -x "$generate_googleapis_gen"

# Display the state of googleapis-gen
git -C googleapis-gen log main

popd