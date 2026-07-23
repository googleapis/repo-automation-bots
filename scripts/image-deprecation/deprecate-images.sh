#!/bin/bash

# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

set -eo pipefail

DRY_RUN=false
IMAGES_INPUT=""
DAYS_CUTOFF=30
EXIT_CODE=0

# Parse command-line options
while getopts "di:t:" opt; do
  case $opt in
    d)
      DRY_RUN=true
      ;;
    i)
      IMAGES_INPUT=$OPTARG
      ;;
    t)
      DAYS_CUTOFF=$OPTARG
      ;;
    *)
      echo "Usage: $0 [-d] [-i <image1,image2,...>] [-t <days>]"
      echo "  -d: Dry run (preview changes without applying tags)"
      echo "  -i: Comma-separated list of images (overrides defaults)"
      echo "  -t: Only check images created in the last N days (default: 30)"
      exit 1
      ;;
  esac
done

# Helper function to convert GCR path to AR path
to_ar_path() {
  local gcr_path="$1"
  local -a parts
  IFS='/' read -r -a parts <<< "$gcr_path"
  if [ "${#parts[@]}" -lt 3 ]; then
    echo "$gcr_path"
    return
  fi
  
  local domain="${parts[0]}"
  local project="${parts[1]}"
  local image_path
  image_path=$(IFS=/; echo "${parts[*]:2}")
  
  case "$domain" in
    gcr.io|us.gcr.io)
      echo "us-docker.pkg.dev/$project/$domain/$image_path"
      ;;
    *)
      echo "$gcr_path"
      ;;
  esac
}

# Calculate cutoff date in ISO 8601 format
CUTOFF_DATE=$(date -d "$DAYS_CUTOFF days ago" -u +"%Y-%m-%dT%H:%M:%SZ")
echo "Only checking images created after $CUTOFF_DATE ($DAYS_CUTOFF days ago)"

# Define default images if not provided via input
if [ -z "$IMAGES_INPUT" ]; then
  echo "No images specified. Using default list."
  IMAGES=(
    "gcr.io/repo-automation-bots/owlbot-cli"
  )
else
  # Remove all whitespace
  IMAGES_INPUT="${IMAGES_INPUT//[[:space:]]/}"
  IFS=',' read -r -a IMAGES <<< "$IMAGES_INPUT"
fi

if [ "$DRY_RUN" = true ]; then
  echo "--- DRY RUN MODE ---"
fi

for IMAGE in "${IMAGES[@]}"; do
  AR_IMAGE=$(to_ar_path "$IMAGE")
  echo "========================================="
  echo "Checking image: $IMAGE (AR: $AR_IMAGE)"
  echo "========================================="

  # Fetch image versions within cutoff date, sorted newest first (server-side)
  if ! images_json=$(gcloud artifacts docker images list "$AR_IMAGE" \
      --include-tags \
      --filter="createTime > '$CUTOFF_DATE'" \
      --sort-by="~createTime" \
      --format="json" 2>/dev/null); then
    echo "Error: Failed to list images for $IMAGE. Skipping."
    EXIT_CODE=1
    continue
  fi

  # Filter the server-sorted and date-filtered images:
  # 1. Exclude metadata artifacts (like provenance files)
  # 2. Skip the absolute latest actual image (.[1:])
  # 3. Filter out if it has compliant tags (deprecated- or infrastructure-)
  eligible_images=$(echo "$images_json" | jq -r '
    [.[] | select(.metadata.artifactType | not)] |
    .[1:] | .[] | 
    select(
      ((.tags // []) | map(
        startswith("deprecated-public-image-") or
        startswith("infrastructure-public-image-")
      ) | any | not)
    ) | .version
  ')

  if [ -z "$eligible_images" ]; then
    echo "No eligible images found in the last $DAYS_CUTOFF days for $IMAGE."
    continue
  fi

  # Convert to array
  mapfile -t digests_array <<< "$eligible_images"
  echo "Found ${#digests_array[@]} eligible images. Scanning for vulnerabilities..."

  # Query vulnerabilities for each eligible image digest
  vulnerable_digests=()
  i=1
  for digest in "${digests_array[@]}"; do
    echo -n "  [Scan $i/${#digests_array[@]}] Checking $AR_IMAGE@$digest... "
    
    if vuln_output=$(gcloud artifacts vulnerabilities list "$AR_IMAGE@$digest" --format="json" 2>/dev/null); then
      if echo "$vuln_output" | jq -e 'map(select(. != null)) | length > 0' >/dev/null; then
        echo "VULNERABLE"
        vulnerable_digests+=("$digest")
      else
        echo "CLEAN"
      fi
    else
      echo "ERROR (Failed to query)"
      EXIT_CODE=1
    fi
    i=$((i+1))
  done

  echo "Scan complete. Found ${#vulnerable_digests[@]} vulnerable images out of ${#digests_array[@]} eligible images."

  if [ ${#vulnerable_digests[@]} -eq 0 ]; then
    echo "No vulnerable images need deprecation tagging for $IMAGE."
    continue
  fi

  # Tag only the vulnerable images
  echo "Processing ${#vulnerable_digests[@]} images..."
  for digest in "${vulnerable_digests[@]}"; do
    digest_hex=${digest#sha256:}
    tag="deprecated-public-image-$digest_hex"
    
    if [ "$DRY_RUN" = true ]; then
      echo "  [DRY RUN] Would tag with $tag"
    else
      echo "  Tagging with $tag"
      if ! gcloud artifacts docker tags add "$AR_IMAGE@$digest" "$AR_IMAGE:$tag" --quiet >/dev/null; then
        echo "  ERROR: Failed to tag $digest"
        EXIT_CODE=1
      fi
    fi
  done
done

exit "$EXIT_CODE"
