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

# Optional arguments.
#
# BUILD_TARGETS: Build targets to rebuild.  Example: 
#   //google/cloud/vision/v1:vision-v1-nodejs
#
# BAZEL_FLAGS: additional flags to pass to 'bazel query' and 'bazel build'.
# Useful for setting a remote cache, coping with different versions of bazel, etc.

# Fail immediately.
set -e

# path to clone of https://github.com/googleapis/googleapis with
#   with the correct source branch checked out.
export GOOGLEAPIS=${GOOGLEAPIS:=`realpath googleapis`}

# path to clone of https://github.com/googleapis/googleapis-gen
#   with the correct target branch checked out.
export GOOGLEAPIS_GEN=${GOOGLEAPIS_GEN:=`realpath googleapis-gen`}

mydir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

# Override in tests.
INSTALL_CREDENTIALS=${INSTALL_CREDENTIALS:="$mydir/install-credentials.sh"}

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
        # If as $sha is contained in a list of bad SHAs (SHAs that
        # will cause bazel to fail) skip the sha. The variable $BROKEN_SHAS
        # is defined in the Cloud Build UI, with the intention that it is only
        # used for exceptional circumstances.
        if echo $BROKEN_SHAS | grep $sha; then
            echo "skipping $sha"
        else
            ungenerated_shas+=($sha)
        fi
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
        && bazel query $BAZEL_FLAGS  'filter("-(go|csharp|java|php|ruby|nodejs|py)$", kind("rule", //...:*))' \
        | grep -v -E ":(proto|grpc|gapic)-.*-java$")
    else
        targets="$BUILD_TARGETS"
    fi
    # Clean out all the source packages from the previous build.
    rm -f $(find -L "$GOOGLEAPIS/bazel-bin" -name "*.tar.gz")
    # Confirm that bazel can fetch remote build dependencies before building
    # with -k.  Otherwise, we can't distinguish a build failure due to a bad proto
    # vs. a build failure due to transient network issue.
    if [[ -z "$FETCH_TARGETS" ]] ; then
        fetch_targets="$targets"
    else
        fetch_targets="$FETCH_TARGETS"
    fi
    (cd "$GOOGLEAPIS" && bazel fetch $BAZEL_FLAGS $fetch_targets)
    # Some API always fails to build.  One failing API should not prevent all other
    # APIs from being updated.
    set +e
    # Invoke bazel build.
    (cd "$GOOGLEAPIS" && bazel build $BAZEL_FLAGS -k $targets)

    # Clear out the existing contents of googleapis-gen before we copy back into it,
    # so that deleted APIs will be be removed.
    rm -rf "$GOOGLEAPIS_GEN/external" "$GOOGLEAPIS_GEN/google" "$GOOGLEAPIS_GEN/grafeas"
    
    # Untar the generated source files into googleapis-gen.
    let target_count=0
    failed_targets=()
    for target in $targets ; do
        let target_count++
        tar_gz=$(echo "${target:2}.tar.gz" | tr ":" "/")
        # Create the parent directory if it doesn't already exist.
        parent_dir=$(dirname $tar_gz)
        target_dir="$GOOGLEAPIS_GEN/$parent_dir"
        mkdir -p "$target_dir"
        tar -xf "$GOOGLEAPIS/bazel-bin/$tar_gz" -C "$target_dir" || {
            failed_targets+=($target)
            # Restore the original source code because bazel failed to generate
            # the new source code.
            git -C "$GOOGLEAPIS_GEN" checkout -- "$target_dir"
            # TODO: report an issue with 'gh'
        }
    done

    # Report failures.
    let failed_percent="100 * ${#failed_targets[@]} / $target_count"
    set -e
    echo "$failed_percent% of targets failed to build."
    printf '%s\n' "${failed_targets[@]}"

    # Tell git about the new source code we just copied into googleapis-gen.
    git -C "$GOOGLEAPIS_GEN" add -A

    # Credentials only last 10 minutes, so install them right before git pushing.
    $INSTALL_CREDENTIALS

    if git -C "$GOOGLEAPIS_GEN" diff-index --quiet HEAD ; then
        # No changes to commit, so just push the tag.
        git -C "$GOOGLEAPIS_GEN" tag "googleapis-$sha"
        git -C "$GOOGLEAPIS_GEN" push origin "googleapis-$sha"
    else
        # Determine the current branch so we can explicitly push to it
        # TODO(jskeet): use the commented-out line below; it requires
        # a newer version of git (2.23.0) than we have (2.20.1).
        # googleapis_gen_branch=$(git -C "$GOOGLEAPIS_GEN" branch --show-current)
        if [[ $TARGET_BRANCH != "" ]]
        then
          googleapis_gen_branch=$TARGET_BRANCH
        else
          googleapis_gen_branch=master
        fi

        # Copy the commit message from the commit in googleapis.
        git -C "$GOOGLEAPIS" log -1 --format=%B > commit-msg.txt
        echo "Source-Link: https://github.com/googleapis/googleapis/commit/$sha" >> commit-msg.txt
        # Commit changes and push them.
        git -C "$GOOGLEAPIS_GEN" commit -F "$(realpath commit-msg.txt)"
        git -C "$GOOGLEAPIS_GEN" tag "googleapis-$sha"
        git -C "$GOOGLEAPIS_GEN" push origin "$googleapis_gen_branch" "googleapis-$sha"
    fi
done
