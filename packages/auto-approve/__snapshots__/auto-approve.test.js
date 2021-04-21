exports[
  'auto-approve main auto-approve function config does not exist in PR attempts to get codeowners file and create a passing status check if PR contains correct config 1'
] = {
  head_sha: 'c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a',
  name: 'Auto-approve.yml check',
  conclusion: 'success',
  output: {
    title: 'Auto-approve.yml check',
    summary: 'Successful auto-approve.yml config check',
    text: '',
  },
};

exports[
  'auto-approve main auto-approve function config does not exist in PR attempts to get codeowners file and create a failing status check if PR contains wrong config, and error messages check out 1'
] = {
  head_sha: 'c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a',
  name: 'Auto-approve.yml check',
  conclusion: 'failure',
  output: {
    title: 'Auto-approve.yml check',
    summary: 'auto-approve.yml config check failed',
    text:
      'See the following errors in your auto-approve.yml config:\nYou must add this line to to the CODEOWNERS file for auto-approve.yml to your current pull request: .github/auto-approve.yml  @googleapis/github-automation/\nFile is not properly configured YAML\nSchema is invalid\n[{"wrongProperty":"wrongProperty","message":"message"}]\n',
  },
};

exports[
  'auto-approve main auto-approve function config exists on main branch approves and tags a PR if a config exists & is valid & PR is valid 1'
] = {
  head_sha: 'c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a',
  name: 'Auto-approve.yml check',
  conclusion: 'success',
  output: {
    title: 'Auto-approve.yml check',
    summary: 'Successful auto-approve.yml config check',
    text: '',
  },
};

exports[
  'auto-approve main auto-approve function config exists on main branch approves and tags a PR if a config exists & is valid & PR is valid 2'
] = {
  event: 'APPROVE',
};

exports[
  'auto-approve main auto-approve function config exists on main branch submits a failing check if config exists but is not valid 1'
] = {
  head_sha: 'c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a',
  name: 'Auto-approve.yml check',
  conclusion: 'failure',
  output: {
    title: 'Auto-approve.yml check',
    summary: 'auto-approve.yml config check failed',
    text:
      'See the following errors in your auto-approve.yml config:\n\n\nSchema is invalid\n[{"wrongProperty":"wrongProperty","message":"message"}]\n',
  },
};

exports[
  'auto-approve main auto-approve function config exists on main branch logs to the console if config is valid but PR is not 1'
] = {
  head_sha: 'c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a',
  name: 'Auto-approve.yml check',
  conclusion: 'success',
  output: {
    title: 'Auto-approve.yml check',
    summary: 'Successful auto-approve.yml config check',
    text: '',
  },
};

exports[
  'auto-approve main auto-approve function config exists on main branch will not check config on master if the config is modified on PR 1'
] = {
  head_sha: 'c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a',
  name: 'Auto-approve.yml check',
  conclusion: 'failure',
  output: {
    title: 'Auto-approve.yml check',
    summary: 'auto-approve.yml config check failed',
    text: 'See the following errors in your auto-approve.yml config:\n\n\n\n',
  },
};
