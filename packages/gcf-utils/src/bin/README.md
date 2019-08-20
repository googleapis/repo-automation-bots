# genkey

This tool is used to generate new secret keys for
use in bots.

## Pre-work

### Prepare your Google Cloud project (needs to be done once)

1. Enable Cloud KMS.

1. Create a Keyring (recommended: `probot-keys`).

1. Enable Cloud Storage.

### Prepare your Key 

> This needs to be done once per bot


1. Create a Symmetric Key in your `probot-keys` keyring
whose name is the name of the Cloud Function you 
will use for your bot.

1. Ensure you have permissions to Encrypt using that Key.

## Steps

1. Log into your GitHub account which owns the GitHub
Application you wish to use with your bot.

1. Create and download a private key for the bot.

1. Make note of:
   1. The Application ID

   1. The Webhook Secret (you can reset it if needed)

1. Configure your environment

 ```bash
 export PROJECT_ID=<YOUR GCP PROJECT ID>
 export APPLICATION_ID=<YOUR APPLICATION ID>
 export WEBHOOK_SECRET=<YOUR WEBHOOK SECRET>
 export KEYRING=<YOUR KEYRING>
 export KEYFILE=<PATH TO PRIVATE KEY>
 export BUCKET=<NAME OF BUCKET TO STORE KEYS>
 export BOT=<NAME OF YOUR BOT>
 ```

5. Run the `genkey` tool

```bash
genkey gen --keyfile=$KEYFILE --project=$PROJECT_ID \
           --keyring=$KEYRING --bucket=$BUCKET \
           --bot=$BOT --id=$APPLICATION_ID \
           --secret=$WEBHOOK_SECRET
```

This will create a JSON blob of data, encrypt it with the
provided key and upload it to the bucket!
  