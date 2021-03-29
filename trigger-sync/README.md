# Trigger Sync Cloud Build Image

This docker image is designed to help you sync multiple build triggers within a single
repository.

This works by creating a root Google Cloud Build trigger that looks for `cloudbuild.yaml`
configurations. For each one found, create a Cloud Build trigger that will execution
when code is pushed to `$BRANCH_NAME` within that subdirectory. That trigger will
provide substitution values provided in the root `cloudbuild.yaml` as well as an
additional `$_DIRECTORY` substitution which is the path to that `cloudbuild.yaml`.

## Usage

Create a `cloudbuild.yaml` at the root of your repository:

```yaml
steps:
  - name: gcr.io/$PROJECT_ID/trigger-sync
    env:
      - "REPO_NAME=$REPO_NAME"
      - "BRANCH_NAME=$BRANCH_NAME"
      - "PROJECT_ID=$PROJECT_ID"
    args:
      # additional substitutions added here (comma-separated)
      - "_BUCKET=$_BUCKET,_FUNCTION_REGION=$_FUNCTION_REGION"
```

Create the root trigger that sets each of the substitution values:

```bash
gcloud beta builds triggers create github \
  --project="<your-project-id>" \
  --repo-owner="<your-repo-owner>" \
  --repo-name="<your-repo-name>" \
  --description="Sync all triggers" \
  --name="sync-triggers" \
  --branch-pattern="^<your-branch-name>$" \
  --build-config="cloudbuild.yaml" \
  --substitutions="_YOUR_SUBTITUTION=values"
```

### Caveats

This currently only creates the triggers that do not exist. If you need to
change configuration for a trigger, delete the trigger and let the sync
script regenerate it.
