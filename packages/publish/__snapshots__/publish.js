exports['publish should publish candidate release to npm, if "publish:candidate" added 1'] = `
This is a pre-release for testing purposes of #2.

Install by running \`npm install tiny-tarball@next\`
`

exports['publish should publish to npm if configuration found 1'] = `
//registry.example.com/:_authToken=abc123
registry=https://registry.example.com/
`

exports['publish should increment candidate version #, if multiple candidates are published 1'] = `
This is a pre-release for testing purposes of #2.

Install by running \`npm install tiny-tarball@next\`
`

exports['publish should increment candidate version #, if multiple candidates are published 2'] = `
//registry.example.com/:_authToken=abc123
registry=https://registry.example.com/
`

exports['publish should publish candidate release to npm, if "publish:candidate" added 2'] = `
//registry.example.com/:_authToken=abc123
registry=https://registry.example.com/
`

exports['publish should publish candidate release to npm, if "publish:candidate" added 3'] = `
A candidate release, \`2.0.0-beta.0\` was published to npm. Run \`npm install tiny-tarball@next\` to install.
`

exports['publish should increment candidate version #, if multiple candidates are published 3'] = `
A candidate release, \`2.0.0-beta.2\` was published to npm. Run \`npm install tiny-tarball@next\` to install.
`

exports['publish should publish candidate release to npm, if "publish:candidate" added 4'] = {
  "name": "tiny-tarball",
  "version": "2.0.0-beta.0",
  "description": "tiny tarball used for health checks",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "author": "Ben Coe <ben@npmjs.com>",
  "license": "ISC"
}

exports['publish should increment candidate version #, if multiple candidates are published 4'] = {
  "name": "tiny-tarball",
  "version": "2.0.0-beta.2",
  "description": "tiny tarball used for health checks",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "author": "Ben Coe <ben@npmjs.com>",
  "license": "ISC"
}
