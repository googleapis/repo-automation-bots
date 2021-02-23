# Label Sync
> This bot automatically creates labels in your GitHub repository for you!

The bot will find labels that should be created from two sources:
- Process labels - There is a common set of labels available in [labels.json](https://github.com/googleapis/repo-automation-bots/blob/master/packages/label-sync/src/labels.json).  Those should be automatically added.  Examples here are `priority: p1`, `type: process`, and `external`.
- API labels - For every API tracked in devrel services, an `api: service_name` label will be created.  You can see the full list of available apis at http://devrel/products (Googlers only link).

Where label-sync creates and cleans up labels in your repository, auto-label adds labels to specific issues based on the product.

**note**: This bot is currently only useful for Googlers. If you're looking for a general purpose label sync bot, we suggest using the [Settings Probot App](https://probot.github.io/apps/settings/).

## Using the bot
If you have admin rights on your repository, you can follow the [installation](https://github.com/apps/google-cloud-label-sync) guide. Labels will be synchronized in a few situations:
- Initially when the application is installed
- Any time a label is modified (deleted, edited)
- On repository create or transfer
- On a cron job nightly, just in case we miss something

## Questions
If you install the repository, and no labels get created for you ... [file a bug](https://github.com/googleapis/repo-automation-bots/issues/new?template=bug_report.md)!  We'd be happy to take a look.
