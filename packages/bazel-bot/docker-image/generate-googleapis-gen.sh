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

# This script:
#  1. Scans googleapis-gen and compares to googleapis to see if any new changes to
#     to the APIs need for their client library code to be regenerated.
#  2. Regenerates the client library code by invoking bazel build on select targets.
#  3. Pushes changes to googleapis-gen.

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
export GOOGLEAPIS=${GOOGLEAPIS:=`realpath googleapis`}

# path to clone of https://github.com/googleapis/googleapis-gen
#   with master branch checked out.
export GOOGLEAPIS_GEN=${GOOGLEAPIS_GEN:=`realpath googleapis-gen`}

# Override in tests.
INSTALL_CREDENTIALS=${INSTALL_CREDENTIALS:=`realpath install-credentials.sh`}

# If the number of failed build targets exceeds this percent, then googleapis-gen
# will not be updated.  Prevents a systemic build failure from wiping out googleapis-gen.
TOTAL_FAILURE_PERCENT=${TOTAL_FAILURE_PERCENT:=10}

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
    # Clean out all the source packages from the previous build.
    rm -f $(find -L "$GOOGLEAPIS/bazel-bin" -name "*.tar.gz")
    # Some API always fails to build.  One failing API should not prevent all other
    # APIs from being updated.
    set +e
    # Invoke bazel build.
    if [[ -n "$BAZEL_REMOTE_CACHE" ]] ; then
        (cd "$GOOGLEAPIS" && bazel build --google_default_credentials \
            "--remote_cache=$BAZEL_REMOTE_CACHE" -k $targets)
    else
        (cd "$GOOGLEAPIS" && bazel build -k $targets)
    fi

    # Clear out the existing contents of googleapis-gen before we copy back into it,
    # so that deleted APIs will be be removed.
    rm -rf "$GOOGLEAPIS_GEN/external" "$GOOGLEAPIS_GEN/google" "$GOOGLEAPIS_GEN/grafeas"
    
    # Untar the generated source files into googleapis-gen.
    let target_count=0
    failed_targets=()
    for target in $targets ; do
        let target_count++
        tar_gz=$(echo "${target:2}" | tr ":" "/")
        # Strip the .tar.gz to get the relative dir.
        tar="${tar_gz%.*}"
        relative_dir="${tar%.*}"
        # Create the parent directory if it doesn't already exist.
        parent_dir=`dirname $tar_gz`
        target_dir="$GOOGLEAPIS_GEN/$parent_dir"
        mkdir -p "$target_dir"
        tar -xf "$GOOGLEAPIS/bazel-bin/$tar_gz" -C "$target_dir" || failed_targets+=($target)
    done

    # Report failures.
    let failed_percent="100 * ${#failed_targets[@]} / $target_count"
    set -e
    echo "$failed_percent% of targets failed to build."
    printf '%s\n' "${failed_targets[@]}"
    if [ $failed_percent -gt $TOTAL_FAILURE_PERCENT ] ; then
        echo "TODO: use gh to report an issue."
        continue
    fi

    # Tell git about the new source code we just copied into googleapis-gen.
    git -C "$GOOGLEAPIS_GEN" add -A

    # Credentials only last 10 minutes, so install them right before git pushing.
    $INSTALL_CREDENTIALS

    if git -C "$GOOGLEAPIS_GEN" diff-index --quiet HEAD ; then
        # No changes to commit, so just push the tag.
        git -C "$GOOGLEAPIS_GEN" tag "googleapis-$sha"
        git -C "$GOOGLEAPIS_GEN" push origin "googleapis-$sha"
    else
        # Copy the commit message from the commit in googleapis.
        git -C "$GOOGLEAPIS" log -1 --format=%s%n%n%b > commit-msg.txt
        echo "Source-Link: https://github.com/googleapis/googleapis/commit/$sha" >> commit-msg.txt
        # Commit changes and push them.
        git -C "$GOOGLEAPIS_GEN" commit -F "$(realpath commit-msg.txt)"
        git -C "$GOOGLEAPIS_GEN" tag "googleapis-$sha"
        git -C "$GOOGLEAPIS_GEN" pull
        git -C "$GOOGLEAPIS_GEN" push origin
        git -C "$GOOGLEAPIS_GEN" push origin "googleapis-$sha"
    fi
done