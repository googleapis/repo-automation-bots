exports['auto-approve main auto-approve function config exists on main branch approves and tags a PR if a config exists & is valid & PR is valid 1'] = {
  'head_sha': 'c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a',
  'name': 'Auto-approve.yml check',
  'conclusion': 'success',
  'output': {
    'title': 'Auto-approve.yml check',
    'summary': 'Successful auto-approve.yml config check',
    'text': ''
  }
}

exports['auto-approve main auto-approve function config exists on main branch approves and tags a PR if a config exists & is valid & PR is valid 2'] = {
  'event': 'APPROVE'
}

exports['auto-approve main auto-approve function config exists on main branch does nothing if there is already an approval 1'] = {
  'head_sha': 'c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a',
  'name': 'Auto-approve.yml check',
  'conclusion': 'success',
  'output': {
    'title': 'Auto-approve.yml check',
    'summary': 'Successful auto-approve.yml config check',
    'text': ''
  }
}

exports['auto-approve main auto-approve function config exists on main branch approves and tags a PR if everything is valid, and it is coming from a fork 1'] = {
  'head_sha': '65f14b92a8135948008c6e26344167a2dac9f066',
  'name': 'Auto-approve.yml check',
  'conclusion': 'success',
  'output': {
    'title': 'Auto-approve.yml check',
    'summary': 'Successful auto-approve.yml config check',
    'text': ''
  }
}

exports['auto-approve main auto-approve function config exists on main branch approves and tags a PR if everything is valid, and it is coming from a fork 2'] = {
  'event': 'APPROVE'
}

exports['auto-approve main auto-approve function config exists on main branch submits a failing check if config exists but is not valid 1'] = {
  'head_sha': 'c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a',
  'name': 'Auto-approve.yml check',
  'conclusion': 'failure',
  'output': {
    'title': 'Auto-approve.yml check',
    'summary': 'auto-approve.yml config check failed',
    'text': 'See the following errors in your auto-approve.yml config:\n\n[object Object]\n'
  }
}

exports['auto-approve main auto-approve function config exists on main branch logs to the console if config is valid but PR is not 1'] = {
  'head_sha': 'c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a',
  'name': 'Auto-approve.yml check',
  'conclusion': 'success',
  'output': {
    'title': 'Auto-approve.yml check',
    'summary': 'Successful auto-approve.yml config check',
    'text': ''
  }
}

exports['auto-approve main auto-approve function config exists on main branch will not check config on master if the config is modified on PR 1'] = {
  'head_sha': 'c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a',
  'name': 'Auto-approve.yml check',
  'conclusion': 'failure',
  'output': {
    'title': 'Auto-approve.yml check',
    'summary': 'auto-approve.yml config check failed',
    'text': 'See the following errors in your auto-approve.yml config:\n\n\n'
  }
}

exports['auto-approve gets secrets and authenticates separately for approval creates a separate octokit instance and authenticates with secret in secret manager 1'] = {
  'head_sha': 'c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a',
  'name': 'Auto-approve.yml check',
  'conclusion': 'success',
  'output': {
    'title': 'Auto-approve.yml check',
    'summary': 'Successful auto-approve.yml config check',
    'text': ''
  }
}

exports['auto-approve gets secrets and authenticates separately for approval creates a separate octokit instance and authenticates with secret in secret manager 2'] = {
  'event': 'APPROVE'
}

exports['auto-approve main auto-approve function config does not exist on main branch attempts to get codeowners file and create a passing status check if PR contains correct config 1'] = {
  'head_sha': 'c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a',
  'name': 'Auto-approve.yml check',
  'conclusion': 'success',
  'output': {
    'title': 'Auto-approve.yml check',
    'summary': 'Successful auto-approve.yml config check',
    'text': ''
  }
}

exports['auto-approve main auto-approve function config does not exist on main branch attempts to get codeowners file and create a failing status check if PR contains wrong config, and error messages check out 1'] = {
  'head_sha': 'c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a',
  'name': 'Auto-approve.yml check',
  'conclusion': 'failure',
  'output': {
    'title': 'Auto-approve.yml check',
    'summary': 'auto-approve.yml config check failed',
    'text': 'See the following errors in your auto-approve.yml config:\nYou must add this line to the CODEOWNERS file for auto-approve.yml to merge pull requests on this repo: .github/auto-approve.yml  @googleapis/github-automation/\n[object Object]\n'
  }
}

exports['auto-approve main auto-approve function config does not exist on main branch passes PR if auto-approve is on main, not PR 1'] = {
  'head_sha': 'c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a',
  'name': 'Auto-approve.yml check',
  'conclusion': 'success',
  'output': {
    'title': 'Auto-approve.yml check',
    'summary': 'Successful auto-approve.yml config check',
    'text': ''
  }
}
