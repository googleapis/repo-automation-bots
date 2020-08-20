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
