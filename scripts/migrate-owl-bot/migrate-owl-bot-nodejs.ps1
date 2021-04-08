# Copyright 2021 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

param (
    [string]$workDir
)

function New-TemporaryDirectory {
    $parent = [System.IO.Path]::GetTempPath()
    [string] $name = [System.Guid]::NewGuid()
    New-Item -ItemType Directory -Path (Join-Path $parent $name)
}

# If the repo already exists in the temporary directory, just run "git pull".
# Otherwise, clone it into the temporary directory.
function CloneOrPull-Repo([string]$repo) {
    $name = $repo.split('/')[1]
    if (Test-Path $name) {
        "Using existing ${repo}" | Write-Host
    } else {
        gh repo clone $repo | Write-Host
    }
    return (Resolve-Path $name)
}

# Ask the user a yes or no question and return 'y' or 'n'.
function Query-Yn([string]$prompt) {
    return (Query-Options $prompt 'y','n')
}

# Ask the user to choose between a list of options.
function Query-Options([string]$prompt, $options) {
    $optionText = $options -join '/'
    while ($true) {
        $choice = Read-Host "${prompt} (${optionText})"
        foreach ($option in $options) {
            if ($choice -eq $option) {
                return $option
            }
        }
    }
}

# Inspects synth.metadata and returns the commit hash for googleapis/googleapis.
function Get-GoogleapisCommitHashFromSynthMetadata($metadataPath) {
    if (Test-Path $metadataPath) {
        $metadata = Get-Content $metadataPath | ConvertFrom-Json -AsHashTable
        foreach ($source in $metadata["sources"]) {
            if ($source -and $source["git"] -and ($source["git"]["name"] -eq "googleapis")) {
                return $source["git"]["sha"]
            }
        }
    }
}

# Looks in synth.metadata and computes the commit hash from googleapis-gen.
function Get-SourceCommitHash([string]$localPath, [string]$sourceRepoPath) {
    $metadataPath = Join-Path $localPath synth.metadata
    $commitHash = Get-GoogleapisCommitHashFromSynthMetadata $metadataPath
    if ($commitHash) {
        # Does there exist a corresponding tag in googleapis-gen?
        $tag = git -C $sourceRepoPath tag --list "googleapis-${commitHash}"
        if ($tag) {
            return (git -C $sourceRepoPath log -1 --format=%H "googleapis-${commitHash}")
        } else {
            # The commit hash in synth.metadata must be very old.
            return (git -C $sourceRepoPath log --format=%H | Select-Object -Last 1)
        }
    } else {
        # No clues in synth.metadata.  
        return (git -C $sourceRepoPath log -1 --format=%H master)
    }
}

function Migrate-Repo([string]$localPath, [string]$sourceRepoPath) {
    # Ask the user to look at synth.py and provide the details we need.
    $yamlPath = "$localPath/.github/.OwlBot.yaml"
    cat "$localPath/synth.py"
    if ('n' -eq (Query-Yn "Wanna migrate?")) {
        echo $null >> $yamlPath  # So we don't ask the user again.
        return
    }
    # Create a branch
    git -C $localPath checkout -b owl-bot

    $apiPath = Read-Host "What's the API path in googleapis-gen?"
    if ($apiPath) {
      $copyYaml = "
deep-remove-regex:
  - /owl-bot-staging

deep-copy-regex:
  - source: /${apiPath}/(v.*)/.*-nodejs/(.*)
    dest: /owl-bot-staging/`$1/`$2
"

      $dv = Read-Host "What's the default version?"

      if ($dv) {                
        # Update .repo-metadata.json with the default version.
        $metadataPath = "$localPath/.repo-metadata.json"
        $metadata = Get-Content $metadataPath | ConvertFrom-Json -AsHashTable
        $metadata['default_version'] = $dv
        $metadata | ConvertTo-Json | Out-File $metadataPath -Encoding UTF8
      }
    }

    $sourceCommitHash = Get-SourceCommitHash $localPath $sourceRepoPath
    echo $sourceCommitHash

    # Write Owlbot config files.
    $lockPath = "$localPath/.github/.OwlBot.lock.yaml"
    $yaml = "# Copyright 2021 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the `"License`");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an `"AS IS`" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
docker:
  image: gcr.io/repo-automation-bots/owlbot-nodejs:latest

${copyYaml}
begin-after-commit-hash: ${sourceCommitHash}
"
    $yaml | Out-File $yamlPath -Encoding UTF8

    $lock = "docker:
  digest: sha256:ae81571b8dfb0cea2434a1faff52e3be993aced984cd15b26d45728e7b3355fe
  image: gcr.io/repo-automation-bots/owlbot-nodejs:latest  
"
    $lock | Out-File $lockPath -Encoding UTF8

    $cleanExit = $false
    try {
        # Remove obsolete files.
        Remove-Item "${localPath}/synth.metadata"
        Rename-Item "${localPath}/synth.py" "${localPath}/owlbot.py"
        while ($true) {
            echo "Edit ${yamlPath} and edit or remove ${localPath}/synth.py before I commit changes."
            code -n -w $localPath
            Remove-Item -Force -Recurse $localPath/.vscode

            $commitCount = 0

            # Commit changes
            git -C $localPath add -A
            git -C $localPath commit -m "chore: migrate to owl bot"
            $commitCount += 1

            echo "Copying code from googleapis-gen..."
            # Run copy-code to simulate a copy from googleapis-gen.
            docker run  --user "$(id -u):$(id -g)" --rm -v "${localPath}:/repo" -w /repo `
                -v "${sourceRepoPath}:/source" `
                gcr.io/repo-automation-bots/owlbot-cli copy-code `
                --source-repo /source `
                --source-repo-commit-hash $sourceCommitHash

            git -C $localPath add -A
            git -C $localpath commit --allow-empty -m "chore: copy files from googleapis-gen ${sourceCommitHash}"
            $commitCount += 1

            function Rollback {
                git -C $localPath reset --hard "HEAD~$($commitCount - 1)"
                git -C $localPath reset --soft HEAD~1        
            }

            # And run the post processor.
            # TODO(rennie): change the docker image to repo-automation-bots when it's fixed.
            docker run --user "$(id -u):$(id -g)" --rm -v "${localPath}:/repo" -w /repo `
                gcr.io/repo-automation-bots/owlbot-nodejs:latest
            git -C $localPath add -A
            git -C $localPath commit --allow-empty -m "chore: run the post processor"
            $commitCount += 1

            # Push the result to github and ask the user to look at it.
            pushd .
            try {
                cd $localPath
                git push -f origin owl-bot
                $repoName = Split-Path -Leaf $localPath
                echo "Create a pull request from here: https://github.com/googleapis/${repoName}/compare/owl-bot?expand=1"
            } finally {
                popd
            }

            $choice = Query-Options "Should I`n(m)ark this repo as complete`n(r)etry this repo`n(s)kip to the next repo`n" 'm','r','s'
            if ('m' -eq $choice) {
                echo "Marked complete."
                $cleanExit = $true
                return
            } elseif ('s' -eq $choice) {
                echo "Skipping..."
                Rollback
                return
            } else {  # Retry
                echo "Trying again..."
                Rollback
            }
        }
    } finally {
        if (-not $cleanExit) {
            # Remove these yaml files so we'll start again with this repo
            Remove-Item -Force $yamlPath,$lockPath
        }

    }
}


function Migrate-All([string]$lang, $workDir) {
    pushd .
    try {
        if (!$workDir) {
            $workDir = New-TemporaryDirectory
        }
        Write-Host -ForegroundColor Blue "Working in $workDir"
        # Clone googleapis-gen and get its most recent commit hash.        
        cd $workDir
        $sourceRepoPath = CloneOrPull-Repo googleapis/googleapis-gen
        $currentHash = git -C googleapis-gen log -1 --format=%H

        # Get the list of repos from github.
        $allRepos = gh repo list googleapis --limit 1000
        $matchInfos = $allRepos | Select-String -Pattern "^googleapis/${lang}-[^ \r\n\t]+"
        $repos = $matchInfos.matches.value

        foreach ($repo in $repos) {
            $name = CloneOrPull-Repo $repo
            $owlBotPath = "$name/.github/.OwlBot.yaml"
            if (Test-Path $owlBotPath) {
                Write-Host -ForegroundColor Blue "Skipping $name;  Found $owlBotPath."
            } else {
                Write-Host -ForegroundColor Blue "Migrating $name..."
                Migrate-Repo $name $sourceRepoPath
            }
        }

    } finally {
        popd
    }
}

Migrate-All nodejs $workDir