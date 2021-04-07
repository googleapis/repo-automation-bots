# Migrate Owl Bot Scripts

This directory contains scripts for migrating repositories with synth.py files to
Owl Bot.

## Prerequisites

1.  Install the [github cli](https://cli.github.com/) and sign in.

2.  Install [powershell](https://docs.microsoft.com/en-us/powershell/scripting/install/installing-powershell?view=powershell-7.1).

3.  Install [docker](https://docs.docker.com/get-docker/).

4.  Install [Visual Studio Code](https://code.visualstudio.com/).  Make sure
    `code --version` displays something useful at the command line.

5.  Install [gcloud](https://cloud.google.com/sdk/gcloud) and sign in.

6.  [Configure docker](https://cloud.google.com/sdk/gcloud/reference/auth/configure-docker) to use your gcloud credentials:

    ```
    gcloud auth configure-docker
    ```

    

## Running

First time, run the script like this:
```
$ pwsh migrate-owl-bot-python.ps1 
Working in /tmp/b58ba3cf-00f9-478e-bd8c-d409072d4cb0
```

Copy and paste the working directory!

Pass the working directory to future invocations of the script like this:
```
$ pwsh migrate-owl-bot-python.ps1 /tmp/b58ba3cf-00f9-478e-bd8c-d409072d4cb0
```


## FAQ

### Why is it written in powershell?

These are one-time migration scripts that we do not intend to support 
long term.  Powershell has the right features to get the job done
most quickly.

### Who will run these scripts?

These scripts are intended for Yoshi team members.  We do not expect
anyone outside Yoshi team to need to run these scripts.
