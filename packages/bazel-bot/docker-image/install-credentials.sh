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

# This script uses the github app secret to install credentials in the GOOGLEAPIS_GEN
# repo and the 'gh' command line tool.

set -e

# According to https://docs.github.com/en/developers/apps/authenticating-with-github-apps#authenticating-as-a-github-app
JWT=$(jwt encode --secret "@$GITHUB_APP_SECRET" --iss "$GITHUB_APP_ID" --exp "+9 min" --alg RS256)

# According to https://docs.github.com/en/developers/apps/authenticating-with-github-apps#authenticating-as-an-installation
GITHUB_TOKEN=$(curl -X POST \
    -H "Authorization: Bearer $JWT" \
    -H "Accept: application/vnd.github.v3+json" \
    https://api.github.com/app/installations/$GITHUB_APP_INSTALLATION_ID/access_tokens \
    | jq -r .token)

# According to https://cli.github.com/manual/gh_auth_login
echo "$GITHUB_TOKEN" | gh auth login --with-token

# According to https://docs.github.com/en/developers/apps/authenticating-with-github-apps#http-based-git-access-by-an-installation
git -C "$GOOGLEAPIS_GEN" remote set-url origin \
    https://x-access-token:$GITHUB_TOKEN@github.com/googleapis/googleapis-gen.git
