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

exports['failurechecker does not open an issue if a prior warning issue is still open 1'] = {
  "body": "The following release PRs may have failed:\n\n* #33"
}
