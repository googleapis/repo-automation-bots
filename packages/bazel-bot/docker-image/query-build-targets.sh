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

# This command has been moved into its own .sh for two reasons:
# 1. So it can be easily replaced in tests.
# 2. So it can be called directly from Dockerfile.

cd "$GOOGLEAPIS" \
    && bazel query $BAZEL_FLAGS 'filter("-(go|csharp|java|php|ruby|nodejs|py)\.tar\.gz$", kind("generated file", //...:*))' \
    | grep -v -E ":(proto|grpc|gapic)-.*-java\.tar\.gz$"