exports['validateConfigChanges compatibility tests creates a failing status check for a correct config 1'] = {
  'name': 'auto-label config schema',
  'conclusion': 'failure',
  'head_sha': '19f6a66851125917fa07615dcbc0cd13dad56981',
  'output': {
    'title': 'Config schema error',
    'summary': 'An error found in the config file',
    'text': ".github/.github/auto-label.yaml is not valid YAML 😱 \nbad indentation of a mapping entry (32:5)\n\n 29 |   # To map languages based on proje ...\n 30 |   paths:\n 31 |     [ 'this', 'config', 'is', 'brok ...\n 32 |     src:\n----------^\n 33 |       frontend: 'go'\n 34 |       cartservice: 'dotnet'"
  }
}
