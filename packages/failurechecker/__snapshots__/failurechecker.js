exports['failurechecker opens an issue on GitHub if there exists a pending label > threshold 1'] = {
  "title": "Warning: a recent release failed",
  "body": "The following release PRs may have failed:\n\n* #33",
  "labels": [
    "type: process"
  ]
}

exports['failurechecker opens an issue on GitHub if there exists a tagged label > threshold 1'] = {
  "title": "Warning: a recent release failed",
  "body": "The following release PRs may have failed:\n\n* #33",
  "labels": [
    "type: process"
  ]
}

exports['failurechecker updates an issue with new failures 1'] = {
  "body": "The following release PRs may have failed:\n\n* #33\n* #34"
}

exports['failurechecker opens an issue with multiple failures 1'] = {
  "title": "Warning: a recent release failed",
  "body": "The following release PRs may have failed:\n\n* #33\n* #34",
  "labels": [
    "type: process"
  ]
}

exports['failurechecker closes a PR once failing releases are handled 1'] = {
  "state": "closed"
}
