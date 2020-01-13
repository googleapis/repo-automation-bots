exports['buildcop app testsFailed opens an issue when testsFailed 1'] = {
  "title": "The build failed",
  "body": "The build failed\nbuildID: 123\nbuildURL: http://example.com\nstatus: failed",
  "labels": [
    "type: bug",
    "priority: p1",
    "buildcop:issue"
  ]
}

exports['buildcop app testsFailed opens a new issue when testsFailed and there is a previous one closed 1'] = {
  "title": "The build failed",
  "body": "The build failed\nbuildID: 123\nbuildURL: http://example.com\nstatus: failed",
  "labels": [
    "type: bug",
    "priority: p1",
    "buildcop:issue"
  ]
}

exports['buildcop app testsFailed comments on an existing open issue when testsFailed 1'] = {
  "body": "The build failed\nbuildID: 123\nbuildURL: http://example.com\nstatus: failed"
}

exports['buildcop app xunitXML opens an issue 1'] = {
  "title": "spanner/spanner_snippets: TestSample failed",
  "body": "spanner/spanner_snippets: TestSample failed\nbuildID: 123\nbuildURL: http://example.com\nstatus: failed",
  "labels": [
    "type: bug",
    "priority: p1",
    "buildcop:issue"
  ]
}

exports['buildcop app xunitXML comments on existing issue 1'] = {
  "body": "spanner/spanner_snippets: TestSample failed\nbuildID: 123\nbuildURL: http://example.com\nstatus: failed"
}

exports['buildcop app xunitXML reopens issue for failing test 1'] = {
  "state": "open"
}

exports['buildcop app xunitXML reopens issue for failing test 2'] = {
  "body": "spanner/spanner_snippets: TestSample failed\nbuildID: 123\nbuildURL: http://example.com\nstatus: failed"
}

exports['buildcop app xunitXML closes an issue for a passing test 1'] = {
  "body": "Test passed in build 123 (http://example.com)! Closing this issue."
}

exports['buildcop app xunitXML closes an issue for a passing test 2'] = {
  "state": "closed"
}

exports['buildcop app xunitXML opens multiple issues for multiple failures 1'] = {
  "title": "storage/buckets: TestBucketLock failed",
  "body": "storage/buckets: TestBucketLock failed\nbuildID: 123\nbuildURL: http://example.com\nstatus: failed",
  "labels": [
    "type: bug",
    "priority: p1",
    "buildcop:issue"
  ]
}

exports['buildcop app xunitXML opens multiple issues for multiple failures 2'] = {
  "title": "storage/buckets: TestUniformBucketLevelAccess failed",
  "body": "storage/buckets: TestUniformBucketLevelAccess failed\nbuildID: 123\nbuildURL: http://example.com\nstatus: failed",
  "labels": [
    "type: bug",
    "priority: p1",
    "buildcop:issue"
  ]
}

exports['buildcop app xunitXML opens multiple issues for multiple failures 3'] = {
  "title": "storage/buckets: TestDelete failed",
  "body": "storage/buckets: TestDelete failed\nbuildID: 123\nbuildURL: http://example.com\nstatus: failed",
  "labels": [
    "type: bug",
    "priority: p1",
    "buildcop:issue"
  ]
}
