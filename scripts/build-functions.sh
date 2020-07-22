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

# For each item in packages directory run npm compile
# then copy to targets
workdir=$(pwd)
echo "$workdir"
targets=$workdir/targets
mkdir -p "$targets"
npm install -g typescript
cd packages || exit 1
for f in *; do
    # Skip symlinks and our gcf-utils/generate-bot directory as it is not a function
    if [[ -d "$f" && ! -L "$f" && "$f" != "gcf-utils" && "$f" != "generate-bot" && "$f" != "monitoring-system" && "$f" != "slo-stat-bot" ]]; then
        (
        cd "$f" || exit 1
        echo "$f"
        npm install
        npm run compile
        mkdir -p "$targets/$f"
        cp -r build "$targets/$f"
        cp package.json "$targets/$f/package.json"
        )
    fi
done
