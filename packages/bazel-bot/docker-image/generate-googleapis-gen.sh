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

# Required environment variables:
# GOOGLEAPIS: path to clone of https://github.com/googleapis/googleapis with
#   master branch checked out.
# GOOGLEAPIS_GEN: path to clone of https://github.com/googleapis/googleapis-gen
#   with master branch checked out.
#   Git credentials must have been installed so that a git push to $GOOGLEAPIS_GEN
#   will succeed.
# BAZEL_REMOTE_CACHE: https path to the bazel remote cache.  Example:
#   https://storage.googleapis.com/surferjeff-test2-bazel-cache 

# Optional environment variables used for testing.
# BUILD_TARGETS: Build targets to rebuild.  Example: 
# //google/cloud/vision/v1:vision-v1-nodejs.tar.gz

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
    if [[ -z "$BUILD_TARGETS" ]] ; then
        targets=$(cd "$GOOGLEAPIS" && bazel query 'filter(".*\.tar\.gz$", kind("generated file", //...:*))')
    else
        targets="$BUILD_TARGETS"
    fi
    (cd "$GOOGLEAPIS" && bazel build \
          --remote_cache=$BAZEL_REMOTE_CACHE \
          --google_default_credentials $targets)
    
    # Clear out the existing contents of googleapis-gen.
    rm -rf "$GOOGLEAPIS_GEN/external" "$GOOGLEAPIS_GEN/google" "$GOOGLEAPIS_GEN/grafeas"

    # Copy the generated source files into $GOOGLEAPIS_GEN.
    tars_gzs=$(cd "$GOOGLEAPIS/bazel-out/k8-fastbuild/bin" && find . -name "*.tar.gz")
    for tar_gz in $tars_gzs ; do
        # Strip the .tar.gz to get the relative dir.
        tar="${tar_gz%.*}"
        relative_dir="${tar%.*}"
        # Create the parent directory if it doesn't already exist.
        parent_dir=`dirname $tar_gz`
        target_dir="$GOOGLEAPIS_GEN/$parent_dir"
        mkdir -p "$target_dir"
        tar -xf "$GOOGLEAPIS/bazel-out/k8-fastbuild/bin/$tar_gz" -C "$target_dir"
    done

    # Commit and push the files to github.
    # Copy the commit message from the commit in googleapis.
    git -C "$GOOGLEAPIS" log -1 --format=%s%n%b > commit-msg.txt
    echo "Source-Link: https://github.com/googleapis/googleapis/commit/$sha" >> commit-msg.txt

    git -C "$GOOGLEAPIS_GEN" add -A
    git -C "$GOOGLEAPIS_GEN" commit -F "$(realpath commit-msg.txt)"
    git -C "$GOOGLEAPIS_GEN" tag "googleapis-$sha"
    git -C "$GOOGLEAPIS_GEN" pull
    git -C "$GOOGLEAPIS_GEN" push origin
    git -C "$GOOGLEAPIS_GEN" push origin "googleapis-$sha"

    # TODO: If something failed, open an issue on github/googleapis-gen.
done
