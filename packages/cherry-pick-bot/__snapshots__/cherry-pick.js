exports['cherryPickCommits should cherry pick a single commit 1'] = {
  ref: 'refs/heads/temp-target-branch',
  sha: 'devbranchsha',
};

exports['cherryPickCommits should cherry pick a single commit 2'] = {
  author: {
    name: 'author-name',
    email: 'author@email.com',
  },
  committer: {
    name: 'committer-name',
    email: 'committer@email.com',
  },
  message: 'sibling of abc123',
  parents: ['parentsha'],
  tree: 'treesha',
};

exports['cherryPickCommits should cherry pick a single commit 3'] = {
  force: true,
  sha: 'newcommitsha',
};

exports['cherryPickCommits should cherry pick a single commit 4'] = {
  base: 'temp-target-branch',
  commit_message: 'Merge abc123 into temp-target-branch',
  head: 'abc123',
};

exports['cherryPickCommits should cherry pick a single commit 5'] = {
  author: {
    name: 'author-name',
    email: 'author@email.com',
  },
  committer: {
    name: 'committer-name',
    email: 'committer@email.com',
  },
  message: 'commit message for abc123',
  parents: ['devbranchsha'],
  tree: 'mergetreesha',
};

exports['cherryPickCommits should cherry pick a single commit 6'] = {
  force: true,
  sha: 'newcommitsha2',
};

exports['cherryPickCommits should cherry pick a single commit 7'] = {
  force: true,
  sha: 'newcommitsha2',
};

exports['cherryPickAsPullRequest opens a pull request for single commit 1'] = {
  ref: 'refs/heads/cherry-pick-e99a18-dev',
  sha: 'basesha',
};

exports['cherryPickAsPullRequest opens a pull request for single commit 2'] = {
  head: 'cherry-pick-e99a18-dev',
  base: 'dev',
  title: 'commit message for abc123',
  body: '\n\nCherry-picked commit message for abc123',
};

exports['cherryPickAsPullRequest opens a pull request for multiple commits 1'] =
  {
    ref: 'refs/heads/cherry-pick-e48234-dev',
    sha: 'basesha',
  };

exports['cherryPickAsPullRequest opens a pull request for multiple commits 2'] =
  {
    head: 'cherry-pick-e48234-dev',
    base: 'dev',
    title: 'commit message for abc123',
    body: 'commit message for def234\n\nCherry-picked commit message for abc123, commit message for def234',
  };
