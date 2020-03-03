import synthtool as s
import synthtool.gcp as gcp
import logging
logging.basicConfig(level=logging.DEBUG)
common_templates = gcp.CommonTemplates()
templates = common_templates.node_library()
s.copy(templates, excludes=[
  '.eslintignore',
  '.eslintrc.yml',
  '.github/release-please.yml',
  '.github/workflows/',
  '.github/publish.yml',
  '.kokoro/*.*',
  '.kokoro/**/*.*',
  '.kokoro/**/**/*.*',
  '.nycrc',
  '.prettierignore',
  '.prettierrc',
  'codecov.yaml',
  'README.md',
  'renovate.json'
])
