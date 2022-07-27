exports['failurechecker opens an issue on GitHub if there exists a pending label > threshold 1'] = `
The following release PRs may have failed:

* #33 - The release job is 'autorelease: pending', but expected 'autorelease: published'.
`

exports['failurechecker opens an issue on GitHub if there exists a tagged label > threshold 1'] = `
The following release PRs may have failed:

* #33 - The release job is 'autorelease: tagged', but expected 'autorelease: published'.
`

exports['failurechecker does not open an issue if a prior warning issue is still open 1'] = `
The following release PRs may have failed:

* #33 - The release job failed -- check the build log.
`

exports['failurechecker updates an issue with new failures 1'] = `
The following release PRs may have failed:

* #33 - The release job is 'autorelease: pending', but expected 'autorelease: published'.
* #34 - The release job is 'autorelease: pending', but expected 'autorelease: published'.
`

exports['failurechecker opens an issue with multiple failures 1'] = `
The following release PRs may have failed:

* #33 - The release job is 'autorelease: pending', but expected 'autorelease: published'.
* #34 - The release job is 'autorelease: pending', but expected 'autorelease: published'.
`
