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
    # Git clone returns an error code because config user.email is not set.
    # There's no way to set it for the repo and clone it at the same time.  :-/
    # || true effectively ignores the error.
    git clone https://github.com/googleapis/googleapis || true
    git -C googleapis config user.email "test@example.com"
    git -C googleapis config user.name "Testy McTestFace"
fi
git -C googleapis checkout master

# Select the sha for HEAD~2
sha=$(git -C googleapis log -3 --format=%H | tail -1)

# Create a fake googleapis-gen with the sha tag.
rm -rf googleapis-gen googleapis-gen-clone
mkdir googleapis-gen
git -C googleapis-gen init --initial-branch=master
git -C googleapis-gen config user.email "test@example.com"
git -C googleapis-gen config user.name "Testy McTestFace"
# Hello.txt lives in the root directory and should not be removed.
hello_path=googleapis-gen/hello.txt
echo hello > "$hello_path"
# keepme.java fails to build and therefore should not be removed.
mkdir -p googleapis-gen/google/bogus/api
bogus_file_path=googleapis-gen/google/bogus/api/keepme.java
echo "import *;" > "$bogus_file_path"
# garbage.js should be wiped out by newly generated code.
mkdir -p googleapis-gen/google/cloud/vision/v1/vision-v1-nodejs
garbage_file_path=googleapis-gen/google/cloud/vision/v1/vision-v1-nodejs/garbage.js
echo "garbage" > "$garbage_file_path"

git -C googleapis-gen add -A
git -C googleapis-gen commit -m "Hello world."
git -C googleapis-gen tag "googleapis-$sha"

# Clone googleapis-gen so git push pushes back to local copy.
git clone googleapis-gen googleapis-gen-clone -b master || true
git -C googleapis-gen-clone config user.email "test@example.com"
git -C googleapis-gen-clone config user.name "Testy McTestFace"
git -C googleapis-gen checkout -b other

# Test!
export GOOGLEAPIS_GEN=`realpath googleapis-gen-clone`
export INSTALL_CREDENTIALS="echo 'Pretending to install credentials...''"
export BUILD_TARGETS="//google/cloud/vision/v1:vision-v1-nodejs //google/bogus:api"
export FETCH_TARGETS="//google/cloud/vision/v1:vision-v1-nodejs"
bash -x "$generate_googleapis_gen"

# Display the state of googleapis-gen
git -C googleapis-gen checkout master
git -C googleapis-gen log --name-only

# Confirm that we added at least one commit.
commit_count=$(git -C googleapis-gen log --pretty=%H | wc -l)
if [ $commit_count -lt 2 ] ; then
    echo "ERROR: There should be a new commit in googlapis-gen"
    exit 99
fi

# Confirm the garbage file was removed because it was replaced by new code.
if [ -e "$garbage_file_path" ] ; then
    echo "ERROR: $garbage_file_path should have been removed"
    exit 98
fi

# Confirm that the source code for the target that failed to build still exists.
if [ ! -e "$bogus_file_path" ] ; then
    echo "ERROR: $bogus_file_path should not been removed"
    exit 97
fi

# Confirm that hello.txt still exists because it's not in a source code directory.
if [ ! -e "$hello_path" ] ; then
    echo "ERROR: $hello_path should not been removed"
    exit 96
fi

popd
