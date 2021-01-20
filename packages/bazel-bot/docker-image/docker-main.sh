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

# TODO: install git credentials.

git clone https://github.com/googleapis/googleapis.git
git clone git@github.com:googleapis/googleapis-gen.git

export BAZEL_REMOTE_CACHE=https://storage.googleapis.com/repo-automation-bots-bazel-cache

bash -x generate-googleapis-gen.sh

