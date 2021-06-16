exports['Sync repo settings should create a failing status check for a broken config 1'] = {
  'name': 'sync-repo-settings config schema',
  'conclusion': 'failure',
  'head_sha': '19f6a66851125917fa07615dcbc0cd13dad56981',
  'output': {
    'title': 'Config schema error',
    'summary': 'An error found in the config file',
    'text': 'the given config is not valid YAML 😱 \nduplicated mapping key (45:3)\n\n 42 | permissionRules:\n 43 |   team: yoshi-admins\n 44 |   permission: admin\n 45 |   team: yoshi-java-admins\n--------^\n 46 |   permission: admin\n 47 |   team: yoshi-java'
  }
}
