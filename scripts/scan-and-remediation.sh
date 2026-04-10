#!/bin/bash
# Copyright 2026 Google LLC
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

# Use PROJECT_ID environment variable (automatically set in Cloud Build)
# or fallback to 'repo-automation-bots' for local testing if not set.
PROJECT_ID="${PROJECT_ID:-repo-automation-bots}"

# Logging function with timestamps
log() {
  echo "[$(date +'%Y-%m-%dT%H:%M:%S')] $*"
}

log "INFO: Using Project ID: $PROJECT_ID"

log "INFO: Fetching triggers dynamically..."
# Get all triggers starting with 'packages-' and not ending with '-test'
# Format as "name:id"
TRIGGERS_DATA=$(gcloud builds triggers list --project=$PROJECT_ID --format="json" | jq -r '.[] | select(.name | startswith("packages-") and (endswith("-test") | not)) | .name + ":" + .id')

TOTAL_CHECKED=0
TOTAL_VULNERABLE=0
TOTAL_TRIGGERED=0
TOTAL_SKIPPED=0

# Create a temp file for stderr
STDERR_FILE=$(mktemp)
trap 'rm -f "$STDERR_FILE"' EXIT

for T in $TRIGGERS_DATA; do
  NAME=$(echo $T | cut -d: -f1)
  TRIGGER_ID=$(echo $T | cut -d: -f2)
  
  # Derive image name candidate by removing 'packages-'
  IMAGE=${NAME#packages-}
  
  # Handle known exceptions where trigger name doesn't match image name
  if [ "$IMAGE" == "owl-bot" ]; then
    IMAGE="owl-bot-backend"
  elif [ "$IMAGE" == "canary-bot-gcf" ]; then
    IMAGE="canary-bot"
  elif [ "$IMAGE" == "owl-bot-cli" ]; then
    IMAGE="owlbot-cli"
  elif [ "$IMAGE" == "bazel-bot-build-docker-image" ]; then
    IMAGE="bazel-bot" # Map to the image it builds
  elif [ "$NAME" == "packages-bazel-bot" ]; then
    log "INFO: Skipping run trigger $NAME. The image is checked via packages-bazel-bot-build-docker-image."
    continue
  fi

  log "INFO: Checking $IMAGE (via trigger $NAME)..."
  TOTAL_CHECKED=$((TOTAL_CHECKED + 1))
  
  # Capture stdout and stderr separately to avoid JSON corruption
  # Use location=us to avoid SDK crash
  OUTPUT=$(gcloud artifacts vulnerabilities list us-docker.pkg.dev/$PROJECT_ID/gcr.io/$IMAGE --location=us --format=json 2>"$STDERR_FILE")
  STATUS=$?
  
  if [ $STATUS -ne 0 ]; then
    STDERR_CONTENT=$(cat "$STDERR_FILE")
    if echo "$STDERR_CONTENT" | grep -q "Image not found"; then
      log "INFO: Image does not exist for $IMAGE."
    else
      log "ERROR: Failed to check vulnerabilities for $IMAGE. Error: $STDERR_CONTENT"
    fi
    continue
  fi

  if [ "$OUTPUT" == "[]" ] || [ -z "$OUTPUT" ]; then
    log "INFO: No vulnerabilities found in $IMAGE."
    continue
  fi

  COUNT=$(echo "$OUTPUT" | jq '[.[] | select(.occurrence.vulnerability.packageIssue.fixedVersion.kind != "MAXIMUM")] | length')
  
  if [ "$COUNT" -gt 0 ]; then
    log "WARN: Found $COUNT fixable vulnerabilities in $IMAGE. Triggering rebuild..."
    TOTAL_VULNERABLE=$((TOTAL_VULNERABLE + 1))
    
    if gcloud builds triggers run "$TRIGGER_ID" --branch=main --project=$PROJECT_ID; then
      TOTAL_TRIGGERED=$((TOTAL_TRIGGERED + 1))
    else
      log "ERROR: Failed to run trigger for $NAME (using trigger $TRIGGER_ID)"
    fi
  else
    log "INFO: No fixable vulnerabilities found in $IMAGE."
  fi
done

log "INFO: Scan complete."
log "INFO: Total images checked: $TOTAL_CHECKED"
log "INFO: Total images with fixable CVEs: $TOTAL_VULNERABLE"
log "INFO: Total triggers executed: $TOTAL_TRIGGERED"
log "INFO: Total triggers skipped: $TOTAL_SKIPPED"
