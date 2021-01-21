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

# Optional environment variables used for testing.
#
# BUILD_TARGETS: Build targets to rebuild.  Example: 
#   //google/cloud/vision/v1:vision-v1-nodejs.tar.gz
#
# BAZEL_REMOTE_CACHE: https path to the bazel remote cache.  Example:
#   https://storage.googleapis.com/surferjeff-test2-bazel-cache 

# Fail immediately.
set -e

# path to clone of https://github.com/googleapis/googleapis with
#   master branch checked out.
GOOGLEAPIS=${GOOGLEAPIS:="googleapis"}

# path to clone of https://github.com/googleapis/googleapis-gen
#   with master branch checked out.
#   Git credentials must have been installed so that a git push to $GOOGLEAPIS_GEN
#   will succeed.
GOOGLEAPIS_GEN=${GOOGLEAPIS_GEN:="googleapis-gen"}

# Pull both repos to make sure we're up to date.
git -C "$GOOGLEAPIS" pull
git -C "$GOOGLEAPIS_GEN" pull

# Collect the history of googleapis.
shas=$(git -C "$GOOGLEAPIS" log --format=%H)

# Collect shas from googleapis for which we haven't yet generated code in googleapis-gen.
git -C "$GOOGLEAPIS_GEN" tag > tags.txt
ungenerated_shas=()
for sha in $shas; do
    if grep $sha tags.txt; then
        # Found a sha we already generated.
        break
    else
        ungenerated_shas+=($sha)
    fi
done

# Iterate over the ungenerated_shas from oldest to newest.
for (( idx=${#ungenerated_shas[@]}-1 ; idx>=0 ; idx-- )) ; do
    sha="${ungenerated_shas[idx]}"

    # Rebuild at the sha.
    git -C "$GOOGLEAPIS" checkout "$sha"
    # Choose build targets.
    if [[ -z "$BUILD_TARGETS" ]] ; then
        targets=$(cd "$GOOGLEAPIS" \
        && bazel query 'filter("-(go|csharp|java|php|ruby|nodejs|py)\.tar\.gz$", kind("generated file", //...:*))' \
        | grep -v -E ":(proto|grpc|gapic)-.*-java\.tar\.gz$")
    else
        targets="$BUILD_TARGETS"
    fi
    # Prepare parameters to use the remote cache, if provided.
    if [[-n "$BAZEL_REMOTE_CACHE"]] ; then
        remote_cache="--google_default_credentials --remote_cache='$BAZEL_REMOTE_CACHE'"
    fi
    # Clean out all the source packages from the previous build.
    rm -f $(find -L "$GOOGLEAPIS/bazel-bin" -name "*.tar.gz")
    # Some API always fails to build.  One failing API should not prevent all other
    # APIs from being updated.
    # TODO: file a bug when something fails to build.
    set +e
    # Invoke bazel build.
    (cd "$GOOGLEAPIS" && bazel build -k $remote_cache $targets)
    
    # Copy the generated source files into $GOOGLEAPIS_GEN.
    for target in $targets ; do
        tar_gz=$(echo "${target:2}" | tr ":" "/")
        # Strip the .tar.gz to get the relative dir.
        tar="${tar_gz%.*}"
        relative_dir="${tar%.*}"
        # Create the parent directory if it doesn't already exist.
        parent_dir=`dirname $tar_gz`
        target_dir="$GOOGLEAPIS_GEN/$parent_dir"
        mkdir -p "$target_dir"
        tar -xf "$GOOGLEAPIS/bazel-bin/$tar_gz" -C "$target_dir"
    done

    # TODO: Check that bazel didn't completely fail.  If it did, we'd generate
    # TODO: about a thousand PRs to delete all the API source code.
    set -e

    # Commit and push the files to github.
    # Copy the commit message from the commit in googleapis.
    git -C "$GOOGLEAPIS" log -1 --format=%s%n%b > commit-msg.txt
    echo "Source-Link: https://github.com/googleapis/googleapis/commit/$sha" >> commit-msg.txt

    git -C "$GOOGLEAPIS_GEN" add -A
    if git -C "$GOOGLEAPIS_GEN" diff-index --quiet HEAD ; then
        # No changes to commit or push.
        git -C "$GOOGLEAPIS_GEN" tag "googleapis-$sha"
        git -C "$GOOGLEAPIS_GEN" push origin "googleapis-$sha"
    else
        # Commit changes and push them.
        git -C "$GOOGLEAPIS_GEN" commit -F "$(realpath commit-msg.txt)"
        git -C "$GOOGLEAPIS_GEN" tag "googleapis-$sha"
        git -C "$GOOGLEAPIS_GEN" pull
        git -C "$GOOGLEAPIS_GEN" push origin
        git -C "$GOOGLEAPIS_GEN" push origin "googleapis-$sha"
    fi
    # TODO: If something failed, open an issue on github/googleapis-gen.
done
