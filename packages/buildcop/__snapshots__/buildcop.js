exports['buildcop app closes an issue for a passing test 1'] = {
  "body": "Test passed in build [TODO: set build_id] ([TODO: set build_url])! Closing this issue."
}

exports['buildcop app closes an issue for a passing test 2'] = {
  "state": "closed"
}

exports['buildcop app reopens issue for failing test 1'] = {
  "state": "open"
}

exports['buildcop app reopens issue for failing test 2'] = {
  "body": "spanner/spanner_snippets: TestSample failed\nbuild_id: [TODO: set build_id]\nbuild_url: [TODO: set build_url]\nstatus: failed"
}

exports['buildcop app opens multiple issues for multiple failures 1'] = {
  "title": "storage/buckets: TestBucketLock failed",
  "body": "storage/buckets: TestBucketLock failed\nbuild_id: 123\nbuild_url: [TODO: set build_url]\nstatus: failed",
  "labels": [
    "buildcop:issue"
  ]
}

exports['buildcop app opens multiple issues for multiple failures 2'] = {
  "title": "storage/buckets: TestUniformBucketLevelAccess failed",
  "body": "storage/buckets: TestUniformBucketLevelAccess failed\nbuild_id: 123\nbuild_url: [TODO: set build_url]\nstatus: failed",
  "labels": [
    "buildcop:issue"
  ]
}

exports['buildcop app opens multiple issues for multiple failures 3'] = {
  "title": "storage/buckets: TestDelete failed",
  "body": "storage/buckets: TestDelete failed\nbuild_id: 123\nbuild_url: [TODO: set build_url]\nstatus: failed",
  "labels": [
    "buildcop:issue"
  ]
}

exports['buildcop findFailures opens an issue 1'] = {
  "title": "spanner/spanner_snippets: TestSample failed",
  "body": "spanner/spanner_snippets: TestSample failed\nbuild_id: [TODO: set build_id]\nbuild_url: [TODO: set build_url]\nstatus: failed",
  "labels": [
    "buildcop:issue"
  ]
}

exports['buildcop app comments on existing issue 1'] = {
  "body": "spanner/spanner_snippets: TestSample failed\nbuild_id: [TODO: set build_id]\nbuild_url: [TODO: set build_url]\nstatus: failed"
}
