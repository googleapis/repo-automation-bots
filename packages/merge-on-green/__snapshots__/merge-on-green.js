exports[
  'merge-on-green responds to pull requests gets branch information when a pull request is opened, responds with a failed status check for no branch protection 1'
] = {
  head_sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
  name: 'merge-on-green-readiness',
  conclusion: 'failure',
  output: {
    title: 'You have no required status checks',
    summary: 'Enforce branch protection on your repo.',
    text:
      'To add required status checks to your repository, please follow instructions in this link: \nhttps://help.github.com/en/github/administering-a-repository/enabling-required-status-checks\n\nIn order to add applications to your repository that will run check runs, please follow instructions here: \nhttps://developer.github.com/apps/installing-github-apps/\n\nLastly, please make sure that your required status checks are the same as the ones listed in your config file if you created one.',
  },
};

exports[
  'merge-on-green responds to pull requests gets branch information when a pull request is opened, responds with a passed status check 1'
] = {
  name: 'merge-on-green-readiness',
  conclusion: 'success',
  head_sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
};

exports[
  'merge-on-green responds to pull requests gets branch information when a pull request is opened, responds with a failed status check because branch protection does not match config 1'
] = {
  head_sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
  name: 'merge-on-green-readiness',
  conclusion: 'failure',
  output: {
    title: 'Your branch protection does not match up with your config file',
    summary: 'Set up your branch protection to match your config file.',
    text:
      'To add required status checks to your repository, please follow instructions in this link: \nhttps://help.github.com/en/github/administering-a-repository/enabling-required-status-checks\n\nIn order to add applications to your repository that will run check runs, please follow instructions here: \nhttps://developer.github.com/apps/installing-github-apps/\n\nLastly, please make sure that your required status checks are the same as the ones listed in your config file.',
  },
};

exports[
  'merge-on-green responds to pull requests gets branch information when a pull request is opened, responds with a failed status check because there are less than 3 tests 1'
] = {
  head_sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
  name: 'merge-on-green-readiness',
  conclusion: 'failure',
  output: {
    title: 'You have less than 3 required status checks',
    summary:
      "You likely don't have all the required status checks you need, please make sure to add the appropriate ones.",
    text:
      'To add required status checks to your repository, please follow instructions in this link: \nhttps://help.github.com/en/github/administering-a-repository/enabling-required-status-checks\n\nIn order to add applications to your repository that will run check runs, please follow instructions here: \nhttps://developer.github.com/apps/installing-github-apps/\n\nLastly, please make sure that your required status checks are the same as the ones listed in your config file if you created one.',
  },
};
