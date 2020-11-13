exports['snippet-bot responds to PR sets a "failure" context on PR 1'] = {
  name: 'Mismatched region tag',
  conclusion: 'failure',
  head_sha: 'ce03c1b7977aadefb5f6afc09901f106ee6ece6a',
  output: {
    title: 'Mismatched region tag detected.',
    summary: 'Some new files have mismatched region tag',
    text:
      "test.py:5, tag `hello` has already started\ntest.py:10, tag `lol` doesn't have a matching start tag\ntest.py:8, tag `world` doesn't have a matching end tag",
  },
};

exports['snippet-bot responds to issue reports the scan result 1'] = {
  body:
    "<!-- probot comment [11359653]-->\n\n## snippet-bot scan result\nLife is too short to manually check unmatched region tags.\nHere is the result:\n- [ ] [test.py:3](https://github.com/tmatsuo/python-docs-samples/blob/abcde/test.py#L3), tag `lol` doesn't have a matching start tag\n- [ ] [test.py:1](https://github.com/tmatsuo/python-docs-samples/blob/abcde/test.py#L1), tag `hello` doesn't have a matching end tag\n\n---\nReport generated by [snippet-bot](https://github.com/apps/snippet-bot).\nIf you find problems with this result, please file an issue at:\nhttps://github.com/googleapis/repo-automation-bots/issues.\n",
};

exports[
  'snippet-bot responds to issue reports failure upon download failure 1'
] = {
  body:
    '<!-- probot comment [11359653]-->\n\n## snippet-bot scan result\nFailed running the full scan: Error: Failed to scan files: unexpected response Forbidden.\n\n---\nReport generated by [snippet-bot](https://github.com/apps/snippet-bot).\nIf you find problems with this result, please file an issue at:\nhttps://github.com/googleapis/repo-automation-bots/issues.\n',
};

exports['snippet-bot responds to PR sets a "failure" context on PR 2'] = {
  body:
    '<!-- probot comment [11237253]-->\nHere is the summary of possible violations 😱<details>\n  <summary>There is a possible violation for not having product prefix.</summary>\n\n  - [`key_with_parent` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32)\n\n</details>\n\n---\nHere is the summary of changes.\n<details>\n  <summary>You added 3 region tags.</summary>\n\n  - [`datastore_incomplete_key2` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L22)\n- [`datastore_named_key2` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L27)\n- [`key_with_parent` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32)\n\n</details>\n\n<details>\n  <summary>You deleted 3 region tags.\n</summary>\n\n  - [`datastore_incomplete_key` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L22)\n- [`datastore_named_key` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L27)\n- [`datastore_key_with_parent` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L32)\n\n</details>\n\nThis comment is generated by [snippet-bot](https://github.com/apps/snippet-bot).\nIf you find problems with this result, please file an issue at:\nhttps://github.com/googleapis/repo-automation-bots/issues.\nTo update this comment, add `snippet-bot:force-run` label.\n',
};

exports[
  'snippet-bot responds to PR responds to snippet-bot:force-run label 1'
] = {
  name: 'Mismatched region tag',
  conclusion: 'failure',
  head_sha: 'ce03c1b7977aadefb5f6afc09901f106ee6ece6a',
  output: {
    title: 'Mismatched region tag detected.',
    summary: 'Some new files have mismatched region tag',
    text:
      "test.py:5, tag `hello` has already started\ntest.py:10, tag `lol` doesn't have a matching start tag\ntest.py:8, tag `world` doesn't have a matching end tag",
  },
};

exports[
  'snippet-bot responds to PR responds to snippet-bot:force-run label 2'
] = {
  body:
    '<!-- probot comment [11237253]-->\nHere is the summary of possible violations 😱<details>\n  <summary>There is a possible violation for not having product prefix.</summary>\n\n  - [`key_with_parent` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32)\n\n</details>\n\n---\nHere is the summary of changes.\n<details>\n  <summary>You added 3 region tags.</summary>\n\n  - [`datastore_incomplete_key2` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L22)\n- [`datastore_named_key2` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L27)\n- [`key_with_parent` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32)\n\n</details>\n\n<details>\n  <summary>You deleted 3 region tags.\n</summary>\n\n  - [`datastore_incomplete_key` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L22)\n- [`datastore_named_key` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L27)\n- [`datastore_key_with_parent` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L32)\n\n</details>\n\nThis comment is generated by [snippet-bot](https://github.com/apps/snippet-bot).\nIf you find problems with this result, please file an issue at:\nhttps://github.com/googleapis/repo-automation-bots/issues.\nTo update this comment, add `snippet-bot:force-run` label.\n',
};

exports[
  'snippet-bot responds to PR ignores 404 error upon label deletion 1'
] = {
  name: 'Mismatched region tag',
  conclusion: 'failure',
  head_sha: 'ce03c1b7977aadefb5f6afc09901f106ee6ece6a',
  output: {
    title: 'Mismatched region tag detected.',
    summary: 'Some new files have mismatched region tag',
    text:
      "test.py:5, tag `hello` has already started\ntest.py:10, tag `lol` doesn't have a matching start tag\ntest.py:8, tag `world` doesn't have a matching end tag",
  },
};

exports[
  'snippet-bot responds to PR ignores 404 error upon label deletion 2'
] = {
  body:
    '<!-- probot comment [11237253]-->\nHere is the summary of possible violations 😱<details>\n  <summary>There is a possible violation for not having product prefix.</summary>\n\n  - [`key_with_parent` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32)\n\n</details>\n\n---\nHere is the summary of changes.\n<details>\n  <summary>You added 3 region tags.</summary>\n\n  - [`datastore_incomplete_key2` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L22)\n- [`datastore_named_key2` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L27)\n- [`key_with_parent` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32)\n\n</details>\n\n<details>\n  <summary>You deleted 3 region tags.\n</summary>\n\n  - [`datastore_incomplete_key` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L22)\n- [`datastore_named_key` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L27)\n- [`datastore_key_with_parent` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L32)\n\n</details>\n\nThis comment is generated by [snippet-bot](https://github.com/apps/snippet-bot).\nIf you find problems with this result, please file an issue at:\nhttps://github.com/googleapis/repo-automation-bots/issues.\nTo update this comment, add `snippet-bot:force-run` label.\n',
};

exports[
  'snippet-bot responds to PR does not submit a check on PR by ignoreFile 1'
] = {
  body:
    '<!-- probot comment [11237253]-->\nHere is the summary of changes.\n<details>\n  <summary>You added 3 region tags.</summary>\n\n  - [`datastore_incomplete_key2` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L22)\n- [`datastore_named_key2` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L27)\n- [`key_with_parent` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32)\n\n</details>\n\n<details>\n  <summary>You deleted 3 region tags.\n</summary>\n\n  - [`datastore_incomplete_key` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L22)\n- [`datastore_named_key` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L27)\n- [`datastore_key_with_parent` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L32)\n\n</details>\n\nThis comment is generated by [snippet-bot](https://github.com/apps/snippet-bot).\nIf you find problems with this result, please file an issue at:\nhttps://github.com/googleapis/repo-automation-bots/issues.\nTo update this comment, add `snippet-bot:force-run` label.\n',
};

exports[
  'snippet-bot responds to PR does not submit a check on PR if there are no region tags 1'
] = {
  body:
    '<!-- probot comment [11237253]-->\nHere is the summary of possible violations 😱<details>\n  <summary>There is a possible violation for not having product prefix.</summary>\n\n  - [`key_with_parent` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32)\n\n</details>\n\n---\nHere is the summary of changes.\n<details>\n  <summary>You added 3 region tags.</summary>\n\n  - [`datastore_incomplete_key2` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L22)\n- [`datastore_named_key2` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L27)\n- [`key_with_parent` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32)\n\n</details>\n\n<details>\n  <summary>You deleted 3 region tags.\n</summary>\n\n  - [`datastore_incomplete_key` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L22)\n- [`datastore_named_key` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L27)\n- [`datastore_key_with_parent` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L32)\n\n</details>\n\nThis comment is generated by [snippet-bot](https://github.com/apps/snippet-bot).\nIf you find problems with this result, please file an issue at:\nhttps://github.com/googleapis/repo-automation-bots/issues.\nTo update this comment, add `snippet-bot:force-run` label.\n',
};

exports[
  'snippet-bot responds to PR gives warnings about removing region tag in use 1'
] = {
  name: 'Mismatched region tag',
  conclusion: 'failure',
  head_sha: 'ce03c1b7977aadefb5f6afc09901f106ee6ece6a',
  output: {
    title: 'Mismatched region tag detected.',
    summary: 'Some new files have mismatched region tag',
    text:
      "test.py:5, tag `hello` has already started\ntest.py:10, tag `lol` doesn't have a matching start tag\ntest.py:8, tag `world` doesn't have a matching end tag",
  },
};

exports[
  'snippet-bot responds to PR gives warnings about removing region tag in use 2'
] = {
  body:
    '<!-- probot comment [11237253]-->\nHere is the summary of possible violations 😱<details>\n  <summary>There is a possible violation for not having product prefix.</summary>\n\n  - [`key_with_parent` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32)\n\n</details>\n\n<details>\n  <summary>There is a possible violation for removing region tag in use.</summary>\n\n  - [`datastore_incomplete_key` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L22)\n\n</details>\n\n<details>\n  <summary>There is a possible violation for removing conflicting region tag in use.</summary>\n\n  - [`datastore_named_key` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L27)\n\n</details>\n\n---\nHere is the summary of changes.\n<details>\n  <summary>You added 3 region tags.</summary>\n\n  - [`datastore_incomplete_key2` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L22)\n- [`datastore_named_key2` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L27)\n- [`key_with_parent` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/ce03c1b7977aadefb5f6afc09901f106ee6ece6a/test.py#L32)\n\n</details>\n\n<details>\n  <summary>You deleted 3 region tags.\n</summary>\n\n  - [`datastore_incomplete_key` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L22)\n- [`datastore_named_key` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L27)\n- [`datastore_key_with_parent` in `test.py`](https://github.com/tmatsuo/repo-automation-bots/blob/48d47a91300728008c9712d6e793a6ed5d86e01d/test.py#L32)\n\n</details>\n\nThis comment is generated by [snippet-bot](https://github.com/apps/snippet-bot).\nIf you find problems with this result, please file an issue at:\nhttps://github.com/googleapis/repo-automation-bots/issues.\nTo update this comment, add `snippet-bot:force-run` label.\n',
};
