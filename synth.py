import synthtool as s
import synthtool.gcp as gcp
import logging
logging.basicConfig(level=logging.DEBUG)

AUTOSYNTH_MULTIPLE_COMMITS = True

common_templates = gcp.CommonTemplates()
templates = common_templates.node_library()
s.copy(templates, excludes=[
  '.eslintignore',
  '.eslintrc.json',
  '.github/release-please.yml',
  '.github/workflows/',
  '.github/publish.yml',
  '.kokoro/**',
  '.mocharc.js',
  '.nycrc',
  '.prettierignore',
  '.prettierrc.js',
  'README.md',
  'renovate.json'
])
