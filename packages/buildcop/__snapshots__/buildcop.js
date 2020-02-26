exports['buildcop app testsFailed opens an issue when testsFailed 1'] = {
  "title": "The build failed",
  "body": "The build failed\nbuildID: 123\nbuildURL: http://example.com\nstatus: failed",
  "labels": [
    "type: bug",
    "priority: p1",
    "buildcop: issue"
  ]
}

exports['buildcop app testsFailed opens a new issue when testsFailed and there is a previous one closed 1'] = {
  "title": "The build failed",
  "body": "The build failed\nbuildID: 123\nbuildURL: http://example.com\nstatus: failed",
  "labels": [
    "type: bug",
    "priority: p1",
    "buildcop: issue"
  ]
}

exports['buildcop app testsFailed comments on an existing open issue when testsFailed 1'] = {
  "body": "The build failed\nbuildID: 123\nbuildURL: http://example.com\nstatus: failed"
}

exports['buildcop app xunitXML opens an issue [Go] 1'] = {
  "title": "spanner/spanner_snippets: TestSample failed",
  "body": "spanner/spanner_snippets: TestSample failed\nbuildID: 123\nbuildURL: http://example.com\nstatus: failed",
  "labels": [
    "type: bug",
    "priority: p1",
    "buildcop: issue"
  ]
}

exports['buildcop app xunitXML closes a duplicate issue 1'] = {
  "body": "Closing as a duplicate of #19"
}

exports['buildcop app xunitXML closes a duplicate issue 2'] = {
  "state": "closed"
}

exports['buildcop app xunitXML opens an issue [Python] 1'] = {
  "title": "appengine.flexible.datastore.main_test: test_index failed",
  "body": "appengine.flexible.datastore.main_test: test_index failed\nbuildID: 123\nbuildURL: http://example.com\nstatus: failed",
  "labels": [
    "type: bug",
    "priority: p1",
    "buildcop: issue"
  ]
}

exports['buildcop app xunitXML comments on existing issue 1'] = {
  "body": "spanner/spanner_snippets: TestSample failed\nbuildID: 123\nbuildURL: http://example.com\nstatus: failed"
}

exports['buildcop app xunitXML reopens issue for failing test 1'] = {
  "labels": [
    "type: bug",
    "priority: p1",
    "buildcop: issue",
    "buildcop: flaky",
    "api: spanner"
  ],
  "state": "open"
}

exports['buildcop app xunitXML reopens issue for failing test 2'] = {
  "body": "Oops! Looks like this issue is still flaky. :grimacing:\n\nI reopened the issue, but a human will need to close it again.\n\nspanner/spanner_snippets: TestSample failed\nbuildID: 123\nbuildURL: http://example.com\nstatus: failed"
}

exports['buildcop app xunitXML closes an issue for a passing test [Go] 1'] = {
  "body": "Test passed in build 123 (http://example.com)! Closing this issue."
}

exports['buildcop app xunitXML closes an issue for a passing test [Go] 2'] = {
  "state": "closed"
}

exports['buildcop app xunitXML closes an issue for a passing test [Python] 1'] = {
  "body": "Test passed in build 123 (http://example.com)! Closing this issue."
}

exports['buildcop app xunitXML closes an issue for a passing test [Python] 2'] = {
  "state": "closed"
}

exports['buildcop app xunitXML opens multiple issues for multiple failures 1'] = {
  "title": "storage/buckets: TestBucketLock failed",
  "body": "storage/buckets: TestBucketLock failed\nbuildID: 123\nbuildURL: http://example.com\nstatus: failed",
  "labels": [
    "type: bug",
    "priority: p1",
    "buildcop: issue"
  ]
}

exports['buildcop app xunitXML opens multiple issues for multiple failures 2'] = {
  "title": "storage/buckets: TestUniformBucketLevelAccess failed",
  "body": "storage/buckets: TestUniformBucketLevelAccess failed\nbuildID: 123\nbuildURL: http://example.com\nstatus: failed",
  "labels": [
    "type: bug",
    "priority: p1",
    "buildcop: issue"
  ]
}

exports['buildcop app xunitXML opens an issue [Java] 1'] = {
  "title": "com.google.cloud.vision.it.ITSystemTest: detectSafeSearchGcsTest failed",
  "body": "com.google.cloud.vision.it.ITSystemTest: detectSafeSearchGcsTest failed\nbuildID: 123\nbuildURL: http://example.com\nstatus: failed",
  "labels": [
    "type: bug",
    "priority: p1",
    "buildcop: issue"
  ]
}

exports['buildcop app xunitXML closes an issue for a passing test [Java] 1'] = {
  "body": "Test passed in build 123 (http://example.com)! Closing this issue."
}

exports['buildcop app xunitXML closes an issue for a passing test [Java] 2'] = {
  "state": "closed"
}

exports['buildcop app xunitXML keeps an issue open for a passing test that failed in the same build (comment) 1'] = {
  "labels": [
    "type: bug",
    "priority: p1",
    "buildcop: issue",
    "buildcop: flaky",
    null
  ],
  "state": "open"
}

exports['buildcop app xunitXML keeps an issue open for a passing test that failed in the same build (comment) 2'] = {
  "body": "Looks like this issue is flaky. :worried:\n\nI'm going to leave this open and stop commenting.\n\nA human should fix and close this."
}

exports['buildcop app xunitXML keeps an issue open for a passing test that failed in the same build (issue body) 1'] = {
  "labels": [
    "type: bug",
    "priority: p1",
    "buildcop: issue",
    "buildcop: flaky",
    null
  ],
  "state": "open"
}

exports['buildcop app xunitXML keeps an issue open for a passing test that failed in the same build (issue body) 2'] = {
  "body": "Looks like this issue is flaky. :worried:\n\nI'm going to leave this open and stop commenting.\n\nA human should fix and close this."
}

exports['buildcop app xunitXML does not comment about failure on existing flaky issue 1'] = {
  "body": "storage/buckets: TestUniformBucketLevelAccess failed\nbuildID: 123\nbuildURL: http://example.com\nstatus: failed"
}
