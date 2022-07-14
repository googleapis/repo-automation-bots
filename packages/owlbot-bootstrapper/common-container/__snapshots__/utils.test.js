exports['common utils tests opens a PR against the main branch 1'] = {
  head: 'specialName',
  base: 'main',
  title: 'feat: add initial files for google.cloud.kms.v1',
  body: '- [x] Regenerate this pull request now.\nSource-Link: googleapis/googleapis-gen@6dcb09b5b57875f334f61aebed695e2e4193db5e\nCopy-Tag:\neyJwIjoicGFja2FnZXMvZ29vZ2xlLWNsb3VkLWttcy8uT3dsQm90LnlhbWwiLCJoIjoiNmRjYjA5YjViNTc4NzVmMzM0ZjYxYWViZWQ2OTVlMmU0MTkzZGI1ZSJ9',
};

exports[
  'common utils tests should open an issue on a given repo, and should not print any GH tokens 1'
] = {
  title:
    'Googleapis Bootstrapper failed creating google.cloud.kms.v1 for python',
  body: 'Check build number 1234 in myproject for more details:\n\nWe are missing this piece of critical info, you used ',
};
