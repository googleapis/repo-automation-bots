exports['snippet-bot responds to PR sets a "failure" context on PR without a warning about removal of region tags in use 1'] = {
  "name": "Mismatched region tag",
  "conclusion": "failure",
  "head_sha": "ce03c1b7977aadefb5f6afc09901f106ee6ece6a",
  "output": {
    "title": "Mismatched region tag detected.",
    "summary": "Some new files have mismatched region tag",
    "text": "[test.py:5](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L5), tag `hello` already started.\n[test.py:10](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L10), tag `lol` doesn't have a matching start tag.\n[test.py:8](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L8), tag `world` doesn't have a matching end tag."
  }
}

exports['snippet-bot responds to PR sets a "failure" context on PR without a warning about removal of region tags in use 2'] = {
  "body": "<!-- probot comment [11237253]-->\nHere is the summary of possible violations 😱<details>\n  <summary>There is a possible violation for not having product prefix.</summary>\n\n  - [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32), tag `key_with_parent`\n\n</details>\n\n**The end of the violation section. All the stuff below is FYI purposes only.**\n\n---\nHere is the summary of changes.\n<details>\n  <summary>You are about to add 3 region tags.</summary>\n\n  - [test.py:22](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L22), tag `datastore_incomplete_key2`\n- [test.py:27](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L27), tag `datastore_named_key2`\n- [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32), tag `key_with_parent`\n\n</details>\n\n<details>\n  <summary>You are about to delete 3 region tags.\n</summary>\n\n  - [test.py:22](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L22), tag `datastore_incomplete_key`\n- [test.py:27](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L27), tag `datastore_named_key`\n- [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L32), tag `untracked_region_tag`\n\n</details>\n\n---\nThis comment is generated by [snippet-bot](https://github.com/apps/snippet-bot).\nIf you find problems with this result, please file an issue at:\nhttps://github.com/googleapis/repo-automation-bots/issues.\nTo update this comment, add `snippet-bot:force-run` label or use the checkbox below:\n- [ ] Refresh this comment\n"
}

exports['snippet-bot responds to PR sets a "failure" context on PR without a warning about removal of region tags in use 3'] = {
  "name": "Region tag product prefix",
  "conclusion": "failure",
  "head_sha": "ce03c1b7977aadefb5f6afc09901f106ee6ece6a",
  "output": {
    "title": "Missing region tag prefix",
    "summary": "Some region tags do not have appropriate prefix",
    "text": "<details>\n  <summary>There is a possible violation for not having product prefix.</summary>\n\n  - [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32), tag `key_with_parent`\n\n</details>\n\n"
  }
}

exports['snippet-bot responds to PR responds to snippet-bot:force-run label, invalidating the Snippet cache 1'] = {
  "name": "Mismatched region tag",
  "conclusion": "failure",
  "head_sha": "ce03c1b7977aadefb5f6afc09901f106ee6ece6a",
  "output": {
    "title": "Mismatched region tag detected.",
    "summary": "Some new files have mismatched region tag",
    "text": "[test.py:5](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L5), tag `hello` already started.\n[test.py:10](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L10), tag `lol` doesn't have a matching start tag.\n[test.py:8](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L8), tag `world` doesn't have a matching end tag."
  }
}

exports['snippet-bot responds to PR responds to snippet-bot:force-run label, invalidating the Snippet cache 2'] = {
  "body": "<!-- probot comment [11237253]-->\nHere is the summary of possible violations 😱<details>\n  <summary>There is a possible violation for not having product prefix.</summary>\n\n  - [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32), tag `key_with_parent`\n\n</details>\n\n**The end of the violation section. All the stuff below is FYI purposes only.**\n\n---\nHere is the summary of changes.\n<details>\n  <summary>You are about to add 3 region tags.</summary>\n\n  - [test.py:22](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L22), tag `datastore_incomplete_key2`\n- [test.py:27](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L27), tag `datastore_named_key2`\n- [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32), tag `key_with_parent`\n\n</details>\n\n<details>\n  <summary>You are about to delete 3 region tags.\n</summary>\n\n  - [test.py:22](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L22), tag `datastore_incomplete_key`\n- [test.py:27](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L27), tag `datastore_named_key`\n- [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L32), tag `untracked_region_tag`\n\n</details>\n\n---\nThis comment is generated by [snippet-bot](https://github.com/apps/snippet-bot).\nIf you find problems with this result, please file an issue at:\nhttps://github.com/googleapis/repo-automation-bots/issues.\nTo update this comment, add `snippet-bot:force-run` label or use the checkbox below:\n- [ ] Refresh this comment\n"
}

exports['snippet-bot responds to PR responds to snippet-bot:force-run label, invalidating the Snippet cache 3'] = {
  "name": "Region tag product prefix",
  "conclusion": "failure",
  "head_sha": "ce03c1b7977aadefb5f6afc09901f106ee6ece6a",
  "output": {
    "title": "Missing region tag prefix",
    "summary": "Some region tags do not have appropriate prefix",
    "text": "<details>\n  <summary>There is a possible violation for not having product prefix.</summary>\n\n  - [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32), tag `key_with_parent`\n\n</details>\n\n"
  }
}

exports['snippet-bot responds to PR responds to refresh checkbox, invalidating the Snippet cache, updating without region tag changes 1'] = {
  "body": "<!-- probot comment [11359653]-->\nNo region tags are edited in this PR.\n---\nThis comment is generated by [snippet-bot](https://github.com/apps/snippet-bot).\nIf you find problems with this result, please file an issue at:\nhttps://github.com/googleapis/repo-automation-bots/issues.\nTo update this comment, add `snippet-bot:force-run` label or use the checkbox below:\n- [ ] Refresh this comment\n"
}

exports['snippet-bot responds to PR ignores 404 error upon label deletion 1'] = {
  "name": "Mismatched region tag",
  "conclusion": "failure",
  "head_sha": "ce03c1b7977aadefb5f6afc09901f106ee6ece6a",
  "output": {
    "title": "Mismatched region tag detected.",
    "summary": "Some new files have mismatched region tag",
    "text": "[test.py:5](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L5), tag `hello` already started.\n[test.py:10](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L10), tag `lol` doesn't have a matching start tag.\n[test.py:8](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L8), tag `world` doesn't have a matching end tag."
  }
}

exports['snippet-bot responds to PR ignores 404 error upon label deletion 2'] = {
  "body": "<!-- probot comment [11237253]-->\nHere is the summary of possible violations 😱<details>\n  <summary>There is a possible violation for not having product prefix.</summary>\n\n  - [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32), tag `key_with_parent`\n\n</details>\n\n**The end of the violation section. All the stuff below is FYI purposes only.**\n\n---\nHere is the summary of changes.\n<details>\n  <summary>You are about to add 3 region tags.</summary>\n\n  - [test.py:22](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L22), tag `datastore_incomplete_key2`\n- [test.py:27](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L27), tag `datastore_named_key2`\n- [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32), tag `key_with_parent`\n\n</details>\n\n<details>\n  <summary>You are about to delete 3 region tags.\n</summary>\n\n  - [test.py:22](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L22), tag `datastore_incomplete_key`\n- [test.py:27](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L27), tag `datastore_named_key`\n- [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L32), tag `untracked_region_tag`\n\n</details>\n\n---\nThis comment is generated by [snippet-bot](https://github.com/apps/snippet-bot).\nIf you find problems with this result, please file an issue at:\nhttps://github.com/googleapis/repo-automation-bots/issues.\nTo update this comment, add `snippet-bot:force-run` label or use the checkbox below:\n- [ ] Refresh this comment\n"
}

exports['snippet-bot responds to PR ignores 404 error upon label deletion 3'] = {
  "name": "Region tag product prefix",
  "conclusion": "failure",
  "head_sha": "ce03c1b7977aadefb5f6afc09901f106ee6ece6a",
  "output": {
    "title": "Missing region tag prefix",
    "summary": "Some region tags do not have appropriate prefix",
    "text": "<details>\n  <summary>There is a possible violation for not having product prefix.</summary>\n\n  - [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32), tag `key_with_parent`\n\n</details>\n\n"
  }
}

exports['snippet-bot responds to PR does not submit a check for unmatched region tags on PR if there are no region tags 1'] = {
  "body": "<!-- probot comment [11237253]-->\nHere is the summary of possible violations 😱<details>\n  <summary>There is a possible violation for not having product prefix.</summary>\n\n  - [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32), tag `key_with_parent`\n\n</details>\n\n**The end of the violation section. All the stuff below is FYI purposes only.**\n\n---\nHere is the summary of changes.\n<details>\n  <summary>You are about to add 3 region tags.</summary>\n\n  - [test.py:22](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L22), tag `datastore_incomplete_key2`\n- [test.py:27](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L27), tag `datastore_named_key2`\n- [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32), tag `key_with_parent`\n\n</details>\n\n<details>\n  <summary>You are about to delete 3 region tags.\n</summary>\n\n  - [test.py:22](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L22), tag `datastore_incomplete_key`\n- [test.py:27](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L27), tag `datastore_named_key`\n- [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L32), tag `untracked_region_tag`\n\n</details>\n\n---\nThis comment is generated by [snippet-bot](https://github.com/apps/snippet-bot).\nIf you find problems with this result, please file an issue at:\nhttps://github.com/googleapis/repo-automation-bots/issues.\nTo update this comment, add `snippet-bot:force-run` label or use the checkbox below:\n- [ ] Refresh this comment\n"
}

exports['snippet-bot responds to PR does not submit a check for unmatched region tags on PR if there are no region tags 2'] = {
  "name": "Region tag product prefix",
  "conclusion": "failure",
  "head_sha": "ce03c1b7977aadefb5f6afc09901f106ee6ece6a",
  "output": {
    "title": "Missing region tag prefix",
    "summary": "Some region tags do not have appropriate prefix",
    "text": "<details>\n  <summary>There is a possible violation for not having product prefix.</summary>\n\n  - [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32), tag `key_with_parent`\n\n</details>\n\n"
  }
}

exports['snippet-bot responds to PR does not submit a check on PR by ignoreFile 1'] = {
  "body": "<!-- probot comment [11237253]-->\nHere is the summary of changes.\n<details>\n  <summary>You are about to add 3 region tags.</summary>\n\n  - [test.py:22](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L22), tag `datastore_incomplete_key2`\n- [test.py:27](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L27), tag `datastore_named_key2`\n- [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32), tag `key_with_parent`\n\n</details>\n\n<details>\n  <summary>You are about to delete 3 region tags.\n</summary>\n\n  - [test.py:22](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L22), tag `datastore_incomplete_key`\n- [test.py:27](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L27), tag `datastore_named_key`\n- [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L32), tag `untracked_region_tag`\n\n</details>\n\n---\nThis comment is generated by [snippet-bot](https://github.com/apps/snippet-bot).\nIf you find problems with this result, please file an issue at:\nhttps://github.com/googleapis/repo-automation-bots/issues.\nTo update this comment, add `snippet-bot:force-run` label or use the checkbox below:\n- [ ] Refresh this comment\n"
}

exports['snippet-bot responds to PR submits 3 checks on PR because alwaysCreateStatusCheck is true 1'] = {
  "name": "Mismatched region tag",
  "conclusion": "success",
  "head_sha": "ce03c1b7977aadefb5f6afc09901f106ee6ece6a",
  "output": {
    "title": "Region tag check",
    "summary": "Region tag successful",
    "text": "Region tag successful"
  }
}

exports['snippet-bot responds to PR submits 3 checks on PR because alwaysCreateStatusCheck is true 2'] = {
  "body": "<!-- probot comment [11237253]-->\nNo region tags are edited in this PR.\n---\nThis comment is generated by [snippet-bot](https://github.com/apps/snippet-bot).\nIf you find problems with this result, please file an issue at:\nhttps://github.com/googleapis/repo-automation-bots/issues.\nTo update this comment, add `snippet-bot:force-run` label or use the checkbox below:\n- [ ] Refresh this comment\n"
}

exports['snippet-bot responds to PR submits 3 checks on PR because alwaysCreateStatusCheck is true 3'] = {
  "name": "Region tag product prefix",
  "conclusion": "success",
  "head_sha": "ce03c1b7977aadefb5f6afc09901f106ee6ece6a",
  "output": {
    "title": "No violations",
    "summary": "No violations found",
    "text": "All the tags have appropriate product prefix"
  }
}

exports['snippet-bot responds to PR submits 3 checks on PR because alwaysCreateStatusCheck is true 4'] = {
  "name": "Disruptive region tag removal",
  "conclusion": "success",
  "head_sha": "ce03c1b7977aadefb5f6afc09901f106ee6ece6a",
  "output": {
    "title": "No violations",
    "summary": "No violations found",
    "text": "No disruptive region tag removal"
  }
}

exports['snippet-bot responds to PR gives warnings about removing region tag in use 1'] = {
  "name": "Mismatched region tag",
  "conclusion": "failure",
  "head_sha": "ce03c1b7977aadefb5f6afc09901f106ee6ece6a",
  "output": {
    "title": "Mismatched region tag detected.",
    "summary": "Some new files have mismatched region tag",
    "text": "[test.py:5](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L5), tag `hello` already started.\n[test.py:10](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L10), tag `lol` doesn't have a matching start tag.\n[test.py:8](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L8), tag `world` doesn't have a matching end tag."
  }
}

exports['snippet-bot responds to PR gives warnings about removing region tag in use 2'] = {
  "body": "<!-- probot comment [11237253]-->\nHere is the summary of possible violations 😱<details>\n  <summary>There is a possible violation for not having product prefix.</summary>\n\n  - [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32), tag `key_with_parent`\n\n</details>\n\n<details>\n  <summary>There are 2 possible violations for removing region tag in use.</summary>\n\n  - [test.py:22](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L22), tag `datastore_incomplete_key`(usage: [page 1](https://example.com/used.html)).\n- [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L32), tag `untracked_region_tag`(usage: [page 1](https://example.com/untracked.html)).\n\n</details>\n\n**The end of the violation section. All the stuff below is FYI purposes only.**\n\n---\n<details>\n  <summary>You are about to delete the following sample browser page.</summary>\n\n  - [test.py:22](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L22), tag `datastore_incomplete_key`(usage: [page 1](https://example.com/sample-browser)).\n\n</details>\n\n---\nHere is the summary of changes.\n<details>\n  <summary>You are about to add 3 region tags.</summary>\n\n  - [test.py:22](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L22), tag `datastore_incomplete_key2`\n- [test.py:27](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L27), tag `datastore_named_key2`\n- [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32), tag `key_with_parent`\n\n</details>\n\n<details>\n  <summary>You are about to delete 3 region tags.\n</summary>\n\n  - [test.py:22](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L22), tag `datastore_incomplete_key`\n- [test.py:27](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L27), tag `datastore_named_key`\n- [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L32), tag `untracked_region_tag`\n\n</details>\n\n---\nThis comment is generated by [snippet-bot](https://github.com/apps/snippet-bot).\nIf you find problems with this result, please file an issue at:\nhttps://github.com/googleapis/repo-automation-bots/issues.\nTo update this comment, add `snippet-bot:force-run` label or use the checkbox below:\n- [ ] Refresh this comment\n"
}

exports['snippet-bot responds to PR gives warnings about removing region tag in use 3'] = {
  "name": "Region tag product prefix",
  "conclusion": "failure",
  "head_sha": "ce03c1b7977aadefb5f6afc09901f106ee6ece6a",
  "output": {
    "title": "Missing region tag prefix",
    "summary": "Some region tags do not have appropriate prefix",
    "text": "<details>\n  <summary>There is a possible violation for not having product prefix.</summary>\n\n  - [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32), tag `key_with_parent`\n\n</details>\n\n"
  }
}

exports['snippet-bot responds to PR gives warnings about removing region tag in use 4'] = {
  "name": "Disruptive region tag removal",
  "conclusion": "failure",
  "head_sha": "ce03c1b7977aadefb5f6afc09901f106ee6ece6a",
  "output": {
    "title": "Removal of region tags in use",
    "summary": "",
    "text": "<details>\n  <summary>There are 2 possible violations for removing region tag in use.</summary>\n\n  - [test.py:22](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L22), tag `datastore_incomplete_key`(usage: [page 1](https://example.com/used.html)).\n- [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L32), tag `untracked_region_tag`(usage: [page 1](https://example.com/untracked.html)).\n\n</details>\n\n"
  }
}

exports['snippet-bot responds to PR does not give warnings about wrong product prefix with snippet-bot:no-prefix-req label 1'] = {
  "name": "Mismatched region tag",
  "conclusion": "failure",
  "head_sha": "ce03c1b7977aadefb5f6afc09901f106ee6ece6a",
  "output": {
    "title": "Mismatched region tag detected.",
    "summary": "Some new files have mismatched region tag",
    "text": "[test.py:5](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L5), tag `hello` already started.\n[test.py:10](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L10), tag `lol` doesn't have a matching start tag.\n[test.py:8](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L8), tag `world` doesn't have a matching end tag."
  }
}

exports['snippet-bot responds to PR does not give warnings about wrong product prefix with snippet-bot:no-prefix-req label 2'] = {
  "body": "<!-- probot comment [11237253]-->\nHere is the summary of possible violations 😱<details>\n  <summary>There are 2 possible violations for removing region tag in use.</summary>\n\n  - [test.py:22](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L22), tag `datastore_incomplete_key`(usage: [page 1](https://example.com/used.html)).\n- [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L32), tag `untracked_region_tag`(usage: [page 1](https://example.com/untracked.html)).\n\n</details>\n\n**The end of the violation section. All the stuff below is FYI purposes only.**\n\n---\n<details>\n  <summary>You are about to delete the following sample browser page.</summary>\n\n  - [test.py:22](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L22), tag `datastore_incomplete_key`(usage: [page 1](https://example.com/sample-browser)).\n\n</details>\n\n---\nHere is the summary of changes.\n<details>\n  <summary>You are about to add 3 region tags.</summary>\n\n  - [test.py:22](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L22), tag `datastore_incomplete_key2`\n- [test.py:27](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L27), tag `datastore_named_key2`\n- [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32), tag `key_with_parent`\n\n</details>\n\n<details>\n  <summary>You are about to delete 3 region tags.\n</summary>\n\n  - [test.py:22](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L22), tag `datastore_incomplete_key`\n- [test.py:27](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L27), tag `datastore_named_key`\n- [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L32), tag `untracked_region_tag`\n\n</details>\n\n---\nThis comment is generated by [snippet-bot](https://github.com/apps/snippet-bot).\nIf you find problems with this result, please file an issue at:\nhttps://github.com/googleapis/repo-automation-bots/issues.\nTo update this comment, add `snippet-bot:force-run` label or use the checkbox below:\n- [ ] Refresh this comment\n"
}

exports['snippet-bot responds to PR does not give warnings about wrong product prefix with snippet-bot:no-prefix-req label 3'] = {
  "name": "Disruptive region tag removal",
  "conclusion": "failure",
  "head_sha": "ce03c1b7977aadefb5f6afc09901f106ee6ece6a",
  "output": {
    "title": "Removal of region tags in use",
    "summary": "",
    "text": "<details>\n  <summary>There are 2 possible violations for removing region tag in use.</summary>\n\n  - [test.py:22](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L22), tag `datastore_incomplete_key`(usage: [page 1](https://example.com/used.html)).\n- [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L32), tag `untracked_region_tag`(usage: [page 1](https://example.com/untracked.html)).\n\n</details>\n\n"
  }
}

exports['snippet-bot responds to PR gives fyi message for removing frozen region tag 1'] = {
  "name": "Mismatched region tag",
  "conclusion": "failure",
  "head_sha": "ce03c1b7977aadefb5f6afc09901f106ee6ece6a",
  "output": {
    "title": "Mismatched region tag detected.",
    "summary": "Some new files have mismatched region tag",
    "text": "[test.py:5](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L5), tag `hello` already started.\n[test.py:10](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L10), tag `lol` doesn't have a matching start tag.\n[test.py:8](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L8), tag `world` doesn't have a matching end tag."
  }
}

exports['snippet-bot responds to PR gives fyi message for removing frozen region tag 2'] = {
  "body": "<!-- probot comment [11237253]-->\nHere is the summary of possible violations 😱<details>\n  <summary>There is a possible violation for not having product prefix.</summary>\n\n  - [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32), tag `key_with_parent`\n\n</details>\n\n<details>\n  <summary>There is a possible violation for removing region tag in use.</summary>\n\n  - [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L32), tag `untracked_region_tag`(usage: [page 1](https://example.com/untracked.html)).\n\n</details>\n\n**The end of the violation section. All the stuff below is FYI purposes only.**\n\n---\n<details>\n  <summary>You are about to delete the following frozen region tag.</summary>\n\n  - [test.py:22](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L22), tag `datastore_incomplete_key`(usage: [page 1](https://example.com/used.html)).\n\n</details>\n\n---\nHere is the summary of changes.\n<details>\n  <summary>You are about to add 3 region tags.</summary>\n\n  - [test.py:22](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L22), tag `datastore_incomplete_key2`\n- [test.py:27](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L27), tag `datastore_named_key2`\n- [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32), tag `key_with_parent`\n\n</details>\n\n<details>\n  <summary>You are about to delete 3 region tags.\n</summary>\n\n  - [test.py:22](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L22), tag `datastore_incomplete_key`\n- [test.py:27](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L27), tag `datastore_named_key`\n- [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L32), tag `untracked_region_tag`\n\n</details>\n\n---\nThis comment is generated by [snippet-bot](https://github.com/apps/snippet-bot).\nIf you find problems with this result, please file an issue at:\nhttps://github.com/googleapis/repo-automation-bots/issues.\nTo update this comment, add `snippet-bot:force-run` label or use the checkbox below:\n- [ ] Refresh this comment\n"
}

exports['snippet-bot responds to PR gives fyi message for removing frozen region tag 3'] = {
  "name": "Region tag product prefix",
  "conclusion": "failure",
  "head_sha": "ce03c1b7977aadefb5f6afc09901f106ee6ece6a",
  "output": {
    "title": "Missing region tag prefix",
    "summary": "Some region tags do not have appropriate prefix",
    "text": "<details>\n  <summary>There is a possible violation for not having product prefix.</summary>\n\n  - [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32), tag `key_with_parent`\n\n</details>\n\n"
  }
}

exports['snippet-bot responds to PR gives fyi message for removing frozen region tag 4'] = {
  "name": "Disruptive region tag removal",
  "conclusion": "failure",
  "head_sha": "ce03c1b7977aadefb5f6afc09901f106ee6ece6a",
  "output": {
    "title": "Removal of region tags in use",
    "summary": "",
    "text": "<details>\n  <summary>There is a possible violation for removing region tag in use.</summary>\n\n  - [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L32), tag `untracked_region_tag`(usage: [page 1](https://example.com/untracked.html)).\n\n</details>\n\n"
  }
}

exports['snippet-bot responds to issue reports failure upon download failure 1'] = {
  "body": "<!-- probot comment [11359653]-->\n\n## snippet-bot scan result\nFailed running the full scan: Error: Failed to scan files: unexpected response Forbidden.\n\n---\nReport generated by [snippet-bot](https://github.com/apps/snippet-bot).\nIf you find problems with this result, please file an issue at:\nhttps://github.com/googleapis/repo-automation-bots/issues.\n"
}

exports['snippet-bot responds to issue reports the scan result 1'] = {
  "body": "<!-- probot comment [11359653]-->\n\n## snippet-bot scan result\nLife is too short to manually check unmatched region tags.\nHere is the result:\n- [ ] [test.py:3](https://github.com/tmatsuo/python-docs-samples/blob/abcde/test.py#L3), tag `lol` doesn't have a matching start tag.\n- [ ] [test.py:1](https://github.com/tmatsuo/python-docs-samples/blob/abcde/test.py#L1), tag `hello` doesn't have a matching end tag.\n\n---\nReport generated by [snippet-bot](https://github.com/apps/snippet-bot).\nIf you find problems with this result, please file an issue at:\nhttps://github.com/googleapis/repo-automation-bots/issues.\n"
}

exports['snippet-bot config validation submits a failing check with a broken config file 1'] = {
  "name": "snippet-bot config schema",
  "conclusion": "failure",
  "head_sha": "ce03c1b7977aadefb5f6afc09901f106ee6ece6a",
  "output": {
    "title": "Config schema error",
    "summary": "An error found in the config file",
    "text": ".github/.github/snippet-bot.yml is not valid YAML 😱 \nend of the stream or a document separator is expected (2:13)\n\n 1 | --\n 2 | brokenConfig: true\n-----------------^"
  }
}

exports['snippet-bot responds to PR agggregates 3 checks into one because aggregateChecks is true 1'] = {
  "body": "<!-- probot comment [11237253]-->\nNo region tags are edited in this PR.\n---\nThis comment is generated by [snippet-bot](https://github.com/apps/snippet-bot).\nIf you find problems with this result, please file an issue at:\nhttps://github.com/googleapis/repo-automation-bots/issues.\nTo update this comment, add `snippet-bot:force-run` label or use the checkbox below:\n- [ ] Refresh this comment\n"
}

exports['snippet-bot responds to PR agggregates 3 checks into one because aggregateChecks is true 2'] = {
  "name": "snippet-bot check",
  "conclusion": "success",
  "head_sha": "ce03c1b7977aadefb5f6afc09901f106ee6ece6a",
  "output": {
    "title": "snippet-bot check",
    "summary": "snippet-bot check success",
    "text": "snippet-bot check success"
  }
}

exports['snippet-bot responds to PR creates failure check with combined results 1'] = {
  "body": "<!-- probot comment [11237253]-->\nHere is the summary of possible violations 😱<details>\n  <summary>There is a possible violation for not having product prefix.</summary>\n\n  - [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32), tag `key_with_parent`\n\n</details>\n\n<details>\n  <summary>There are 2 possible violations for removing region tag in use.</summary>\n\n  - [test.py:22](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L22), tag `datastore_incomplete_key`(usage: [page 1](https://example.com/used.html)).\n- [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L32), tag `untracked_region_tag`(usage: [page 1](https://example.com/untracked.html)).\n\n</details>\n\n**The end of the violation section. All the stuff below is FYI purposes only.**\n\n---\n<details>\n  <summary>You are about to delete the following sample browser page.</summary>\n\n  - [test.py:22](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L22), tag `datastore_incomplete_key`(usage: [page 1](https://example.com/sample-browser)).\n\n</details>\n\n---\nHere is the summary of changes.\n<details>\n  <summary>You are about to add 3 region tags.</summary>\n\n  - [test.py:22](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L22), tag `datastore_incomplete_key2`\n- [test.py:27](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L27), tag `datastore_named_key2`\n- [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32), tag `key_with_parent`\n\n</details>\n\n<details>\n  <summary>You are about to delete 3 region tags.\n</summary>\n\n  - [test.py:22](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L22), tag `datastore_incomplete_key`\n- [test.py:27](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L27), tag `datastore_named_key`\n- [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L32), tag `untracked_region_tag`\n\n</details>\n\n---\nThis comment is generated by [snippet-bot](https://github.com/apps/snippet-bot).\nIf you find problems with this result, please file an issue at:\nhttps://github.com/googleapis/repo-automation-bots/issues.\nTo update this comment, add `snippet-bot:force-run` label or use the checkbox below:\n- [ ] Refresh this comment\n"
}

exports['snippet-bot responds to PR creates failure check with combined results 2'] = {
  "name": "snippet-bot check",
  "conclusion": "failure",
  "head_sha": "ce03c1b7977aadefb5f6afc09901f106ee6ece6a",
  "output": {
    "title": "snippet-bot check",
    "summary": "snippet-bot check failure",
    "text": "<details>\n  <summary>Some new files have mismatched region tag</summary>\n\n  [test.py:5](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L5), tag `hello` already started.\n[test.py:10](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L10), tag `lol` doesn't have a matching start tag.\n[test.py:8](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L8), tag `world` doesn't have a matching end tag.\n</details>\n\n<details>\n  <summary>Some region tags do not have appropriate prefix</summary>\n\n  <details>\n  <summary>There is a possible violation for not having product prefix.</summary>\n\n  - [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32), tag `key_with_parent`\n\n</details>\n\n\n</details>\n\n<details>\n  <summary></summary>\n\n  <details>\n  <summary>There are 2 possible violations for removing region tag in use.</summary>\n\n  - [test.py:22](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L22), tag `datastore_incomplete_key`(usage: [page 1](https://example.com/used.html)).\n- [test.py:32](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L32), tag `untracked_region_tag`(usage: [page 1](https://example.com/untracked.html)).\n\n</details>\n\n\n</details>\n\n"
  }
}
