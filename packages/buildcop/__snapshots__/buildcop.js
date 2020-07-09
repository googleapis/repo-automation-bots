exports['buildcop app testsFailed opens an issue when testsFailed 1'] = {
  "title": "The build failed",
  "body": "This test failed!\n\nTo configure my behavior, see [the Build Cop Bot documentation](https://github.com/googleapis/repo-automation-bots/tree/master/packages/buildcop).\n\nIf I'm commenting on this issue too often, add the `buildcop: quiet` label and\nI will stop commenting.\n\n---\n\ncommit: 123\nbuildURL: http://example.com\nstatus: failed",
  "labels": [
    "type: bug",
    "priority: p1",
    "buildcop: issue"
  ]
}

exports['buildcop app testsFailed opens a new issue when testsFailed and there is a previous one closed 1'] = {
  "title": "The build failed",
  "body": "This test failed!\n\nTo configure my behavior, see [the Build Cop Bot documentation](https://github.com/googleapis/repo-automation-bots/tree/master/packages/buildcop).\n\nIf I'm commenting on this issue too often, add the `buildcop: quiet` label and\nI will stop commenting.\n\n---\n\ncommit: 123\nbuildURL: http://example.com\nstatus: failed",
  "labels": [
    "type: bug",
    "priority: p1",
    "buildcop: issue"
  ]
}

exports['buildcop app testsFailed comments on an existing open issue when testsFailed 1'] = {
  "body": "commit: 123\nbuildURL: http://example.com\nstatus: failed"
}

exports['buildcop app xunitXML opens an issue [Go] 1'] = {
  "title": "spanner/spanner_snippets: TestSample failed",
  "body": "This test failed!\n\nTo configure my behavior, see [the Build Cop Bot documentation](https://github.com/googleapis/repo-automation-bots/tree/master/packages/buildcop).\n\nIf I'm commenting on this issue too often, add the `buildcop: quiet` label and\nI will stop commenting.\n\n---\n\ncommit: 123\nbuildURL: http://example.com\nstatus: failed\n<details><summary>Test output</summary><br><pre>\nsnippet_test.go:242: got output \"\"; want it to contain \"4 Venue 4\" snippet_test.go:243: got output \"\"; want it to contain \"19 Venue 19\" snippet_test.go:244: got output \"\"; want it to contain \"42 Venue 42\"\n</pre></details>",
  "labels": [
    "type: bug",
    "priority: p1",
    "buildcop: issue"
  ]
}

exports['buildcop app xunitXML opens an issue [Python] 1'] = {
  "title": "appengine.flexible.datastore.main_test: test_index failed",
  "body": "This test failed!\n\nTo configure my behavior, see [the Build Cop Bot documentation](https://github.com/googleapis/repo-automation-bots/tree/master/packages/buildcop).\n\nIf I'm commenting on this issue too often, add the `buildcop: quiet` label and\nI will stop commenting.\n\n---\n\ncommit: 123\nbuildURL: http://example.com\nstatus: failed\n<details><summary>Test output</summary><br><pre>\nTraceback (most recent call last):\n  File \"/tmpfs/src/github/python-docs-samples/appengine/flexible/datastore/main_test.py\", line 22, in test_index\n    ...\n    </pre></details>",
  "labels": [
    "type: bug",
    "priority: p1",
    "buildcop: issue"
  ]
}

exports['buildcop app xunitXML opens an issue [Java] 1'] = {
  "title": "vision.it.ITSystemTest: detectSafeSearchGcsTest failed",
  "body": "This test failed!\n\nTo configure my behavior, see [the Build Cop Bot documentation](https://github.com/googleapis/repo-automation-bots/tree/master/packages/buildcop).\n\nIf I'm commenting on this issue too often, add the `buildcop: quiet` label and\nI will stop commenting.\n\n---\n\ncommit: 123\nbuildURL: http://example.com\nstatus: failed\n<details><summary>Test output</summary><br><pre>java.lang.AssertionError: expected:<UNLIKELY> but was:<VERY_UNLIKELY>\n\tat org.junit.Assert.fail(Assert.java:89)\n\tat org.junit.Assert.failNotEquals(Assert.java:835)\n\tat org.junit.Assert.assertEquals(Assert.java:120)\n\tat org.junit.Assert.assertEquals(Assert.java:146)\n\tat com.google.cloud.vision.it.ITSystemTest.detectSafeSearchGcsTest(ITSystemTest.java:404)\n\tat sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)\n\tat sun.reflect.NativeMethodAccessorImpl.invoke(NativeMethodAccessorImpl.java:62)\n\tat sun.reflect.DelegatingMethodAccessorImpl.invoke(DelegatingMethodAccessorImpl.java:43)\n\tat java.lang.reflect.Method.invoke(Method.java:498)\n\tat org.junit.runners.model.FrameworkMethod$1.runReflectiveCall(FrameworkMethod.java:59)\n\tat org.junit.internal.runners.model.ReflectiveCallable.run(ReflectiveCallable.java:12)\n\tat org.junit.runners.model.FrameworkMethod.invokeExplosively(FrameworkMethod.java:56)\n\tat org.junit.internal.runners.statements.InvokeMethod.evaluate(InvokeMethod.java:17)\n\tat org.junit.runners.ParentRunner$3.evaluate(ParentRunner.java:306)\n\tat org.junit.runners.BlockJUnit4ClassRunner$1.evaluate(BlockJUnit4ClassRunner.java:100)\n\tat org.junit.runners.ParentRunner.runLeaf(ParentRunner.java:366)\n\tat org.junit.runners.BlockJUnit4ClassRunner.runChild(BlockJUnit4ClassRunner.java:103)\n\tat org.junit.runners.BlockJUnit4ClassRunner.runChild(BlockJUnit4ClassRunner.java:63)\n\tat org.junit.runners.ParentRunner$4.run(ParentRunner.java:331)\n\tat org.junit.runners.ParentRunner$1.schedule(ParentRunner.java:79)\n\tat org.junit.runners.ParentRunner.runChildren(ParentRunner.java:329)\n\tat org.junit.runners.ParentRunner.access$100(ParentRunner.java:66)\n\tat org.junit.runners.ParentRunner$2.evaluate(ParentRunner.java:293)\n\tat org.junit.internal.runners.statements.RunBefores.evaluate(RunBefores.java:26)\n\tat org.junit.internal.runners.statements.RunAfters.evaluate(RunAfters.java:27)\n\tat org.junit.runners.ParentRunner$3.evaluate(ParentRunner.java:306)\n\tat org.junit.runners.ParentRunner.run(ParentRunner.java:413)\n\tat org.junit.runners.Suite.runChild(Suite.java:128)\n\tat org.junit.runners.Suite.runChild(Suite.java:27)\n\tat org.junit.runners.ParentRunner$4.run(ParentRunner.java:331)\n\tat org.junit.runners.ParentRunner$1.schedule(ParentRunner.java:79)\n\tat org.junit.runners.ParentRunner.runChildren(ParentRunner.java:329)\n\tat org.junit.runners.ParentRunner.access$100(ParentRunner.java:66)\n\tat org.junit.runners.ParentRunner$2.evaluate(ParentRunner.java:293)\n\tat org.junit.runners.ParentRunner$3.evaluate(ParentRunner.java:306)\n\tat org.junit.runners.ParentRunner.run(ParentRunner.java:413)\n\tat org.apache.maven.surefire.junitcore.JUnitCore.run(JUnitCore.java:55)\n\tat org.apache.maven.surefire.junitcore.JUnitCoreWrapper.createRequestAndRun(JUnitCoreWrapper.java:137)\n\tat org.apache.maven.surefire.junitcore.JUnitCoreWrapper.executeEager(JUnitCoreWrapper.java:107)\n\tat org.apache.maven.surefire.junitcore.JUnitCoreWrapper.execute(JUnitCoreWrapper.java:83)\n\tat org.apache.maven.surefire.junitcore.JUnitCoreWrapper.execute(JUnitCoreWrapper.java:75)\n\tat org.apache.maven.surefire.junitcore.JUnitCoreProvider.invoke(JUnitCoreProvider.java:158)\n\tat org.apache.maven.surefire.booter.ForkedBooter.runSuitesInProcess(ForkedBooter.java:377)\n\tat org.apache.maven.surefire.booter.ForkedBooter.execute(ForkedBooter.java:138)\n\tat org.apache.maven.surefire.booter.ForkedBooter.run(ForkedBooter.java:465)\n\tat org.apache.maven.surefire.booter.ForkedBooter.main(ForkedBooter.java:451)\n</pre></details>",
  "labels": [
    "type: bug",
    "priority: p1",
    "buildcop: issue"
  ]
}

exports['buildcop app xunitXML opens an issue [Node.js] 1'] = {
  "title": "Spanner: should delete and then insert rows in the example tables failed",
  "body": "This test failed!\n\nTo configure my behavior, see [the Build Cop Bot documentation](https://github.com/googleapis/repo-automation-bots/tree/master/packages/buildcop).\n\nIf I'm commenting on this issue too often, add the `buildcop: quiet` label and\nI will stop commenting.\n\n---\n\ncommit: 123\nbuildURL: http://example.com\nstatus: failed\n<details><summary>Test output</summary><br><pre>expected 'Deleted individual rows in Albums.\\n5 records deleted from Singers.\\n2 records deleted from Singers.\\n0 records deleted from Singers.\\n' to include '3 records deleted from Singers.'\n    AssertionError: expected 'Deleted individual rows in Albums.\\n5 records deleted from Singers.\\n2 records deleted from Singers.\\n0 records deleted from Singers.\\n' to include '3 records deleted from Singers.'\n        at Context.it (system-test/spanner.test.js:198:12)</pre></details>",
  "labels": [
    "type: bug",
    "priority: p1",
    "buildcop: issue"
  ]
}

exports['buildcop app xunitXML comments on existing issue 1'] = {
  "body": "commit: 123\nbuildURL: http://example.com\nstatus: failed\n<details><summary>Test output</summary><br><pre>\nsnippet_test.go:242: got output \"\"; want it to contain \"4 Venue 4\" snippet_test.go:243: got output \"\"; want it to contain \"19 Venue 19\" snippet_test.go:244: got output \"\"; want it to contain \"42 Venue 42\"\n</pre></details>"
}

exports['buildcop app xunitXML does not comment about failure on existing flaky issue 1'] = {
  "body": "commit: 123\nbuildURL: http://example.com\nstatus: failed\n<details><summary>Test output</summary><br><pre>main_test.go:242: failed to enable uniform bucket-level access (\"golang-samples-tests-8-storage-buckets-tests\"): googleapi: Error 404: Not Found, notFound</pre></details>"
}

exports['buildcop app xunitXML does not comment about failure on existing issue labeled quiet 1'] = {
  "body": "commit: 123\nbuildURL: http://example.com\nstatus: failed\n<details><summary>Test output</summary><br><pre>main_test.go:242: failed to enable uniform bucket-level access (\"golang-samples-tests-8-storage-buckets-tests\"): googleapi: Error 404: Not Found, notFound</pre></details>"
}

exports['buildcop app xunitXML reopens issue with correct labels for failing test 1'] = {
  "labels": [
    "buildcop: issue",
    "buildcop: flaky",
    "api: spanner",
    "priority: p2",
    "type: cleanup"
  ],
  "state": "open"
}

exports['buildcop app xunitXML reopens issue with correct labels for failing test 2'] = {
  "body": "Oops! Looks like this issue is still flaky. It failed again. :grimacing:\n\nI reopened the issue, but a human will need to close it again.\n\n---\n\ncommit: 123\nbuildURL: http://example.com\nstatus: failed\n<details><summary>Test output</summary><br><pre>\nsnippet_test.go:242: got output \"\"; want it to contain \"4 Venue 4\" snippet_test.go:243: got output \"\"; want it to contain \"19 Venue 19\" snippet_test.go:244: got output \"\"; want it to contain \"42 Venue 42\"\n</pre></details>"
}

exports['buildcop app xunitXML closes an issue for a passing test [Go] 1'] = {
  "body": "Test passed for commit 123 (http://example.com)! Closing this issue."
}

exports['buildcop app xunitXML closes an issue for a passing test [Go] 2'] = {
  "state": "closed"
}

exports['buildcop app xunitXML closes an issue for a passing test [Python] 1'] = {
  "body": "Test passed for commit 123 (http://example.com)! Closing this issue."
}

exports['buildcop app xunitXML closes an issue for a passing test [Python] 2'] = {
  "state": "closed"
}

exports['buildcop app xunitXML closes an issue for a passing test [Java] 1'] = {
  "body": "Test passed for commit 123 (http://example.com)! Closing this issue."
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
  "body": "Looks like this issue is flaky. :worried:\n\nI'm going to leave this open and stop commenting.\n\nA human should fix and close this.\n\n---\n\nWhen run at the same commit (123), this test passed in one build (http://example.com) and failed in another build ([Build Status](example.com/failure))."
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
  "body": "Looks like this issue is flaky. :worried:\n\nI'm going to leave this open and stop commenting.\n\nA human should fix and close this.\n\n---\n\nWhen run at the same commit (123), this test passed in one build (http://example.com) and failed in another build ([Build Status](example.com/failure))."
}

exports['buildcop app xunitXML opens multiple issues for multiple failures 1'] = {
  "title": "storage/buckets: TestBucketLock failed",
  "body": "This test failed!\n\nTo configure my behavior, see [the Build Cop Bot documentation](https://github.com/googleapis/repo-automation-bots/tree/master/packages/buildcop).\n\nIf I'm commenting on this issue too often, add the `buildcop: quiet` label and\nI will stop commenting.\n\n---\n\ncommit: 123\nbuildURL: http://example.com\nstatus: failed\n<details><summary>Test output</summary><br><pre>main_test.go:234: failed to create bucket (\"golang-samples-tests-8-storage-buckets-tests\"): Post https://storage.googleapis.com/storage/v1/b?alt=json&prettyPrint=false&project=golang-samples-tests-8: read tcp 10.142.0.112:33618->108.177.12.128:443: read: connection reset by peer</pre></details>",
  "labels": [
    "type: bug",
    "priority: p1",
    "buildcop: issue"
  ]
}

exports['buildcop app xunitXML opens multiple issues for multiple failures 2'] = {
  "title": "storage/buckets: TestUniformBucketLevelAccess failed",
  "body": "This test failed!\n\nTo configure my behavior, see [the Build Cop Bot documentation](https://github.com/googleapis/repo-automation-bots/tree/master/packages/buildcop).\n\nIf I'm commenting on this issue too often, add the `buildcop: quiet` label and\nI will stop commenting.\n\n---\n\ncommit: 123\nbuildURL: http://example.com\nstatus: failed\n<details><summary>Test output</summary><br><pre>main_test.go:242: failed to enable uniform bucket-level access (\"golang-samples-tests-8-storage-buckets-tests\"): googleapi: Error 404: Not Found, notFound</pre></details>",
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

exports['buildcop app xunitXML reopens the original flaky issue when there is a duplicate 1'] = {
  "labels": [
    "type: bug",
    "priority: p1",
    "buildcop: issue",
    "buildcop: flaky"
  ],
  "state": "open"
}

exports['buildcop app xunitXML reopens the original flaky issue when there is a duplicate 2'] = {
  "body": "Oops! Looks like this issue is still flaky. It failed again. :grimacing:\n\nI reopened the issue, but a human will need to close it again.\n\n---\n\ncommit: 123\nbuildURL: http://example.com\nstatus: failed\n<details><summary>Test output</summary><br><pre>\nsnippet_test.go:242: got output \"\"; want it to contain \"4 Venue 4\" snippet_test.go:243: got output \"\"; want it to contain \"19 Venue 19\" snippet_test.go:244: got output \"\"; want it to contain \"42 Venue 42\"\n</pre></details>"
}

exports['buildcop app xunitXML only opens one issue for a group of failures [Go] 1'] = {
  "title": "bigquery/snippets/querying: TestQueries failed",
  "body": "This test failed!\n\nTo configure my behavior, see [the Build Cop Bot documentation](https://github.com/googleapis/repo-automation-bots/tree/master/packages/buildcop).\n\nIf I'm commenting on this issue too often, add the `buildcop: quiet` label and\nI will stop commenting.\n\n---\n\ncommit: 123\nbuildURL: http://example.com\nstatus: failed",
  "labels": [
    "type: bug",
    "priority: p1",
    "buildcop: issue"
  ]
}

exports['buildcop app xunitXML opens a new issue when the original is locked [Go] 1'] = {
  "title": "spanner/spanner_snippets: TestSample failed",
  "body": "Note: #16 was also for this test, but it is locked\n\n----\n\ncommit: 123\nbuildURL: http://example.com\nstatus: failed\n<details><summary>Test output</summary><br><pre>\nsnippet_test.go:242: got output \"\"; want it to contain \"4 Venue 4\" snippet_test.go:243: got output \"\"; want it to contain \"19 Venue 19\" snippet_test.go:244: got output \"\"; want it to contain \"42 Venue 42\"\n</pre></details>",
  "labels": [
    "type: bug",
    "priority: p1",
    "buildcop: issue"
  ]
}

exports['buildcop app xunitXML opens a new issue when the original was closed a long time ago [Go] 1'] = {
  "title": "spanner/spanner_snippets: TestSample failed",
  "body": "Note: #16 was also for this test, but it was closed more than 10 days ago. So, I didn't mark it flaky.\n\n----\n\ncommit: 123\nbuildURL: http://example.com\nstatus: failed\n<details><summary>Test output</summary><br><pre>\nsnippet_test.go:242: got output \"\"; want it to contain \"4 Venue 4\" snippet_test.go:243: got output \"\"; want it to contain \"19 Venue 19\" snippet_test.go:244: got output \"\"; want it to contain \"42 Venue 42\"\n</pre></details>",
  "labels": [
    "type: bug",
    "priority: p1",
    "buildcop: issue"
  ]
}

exports['buildcop app xunitXML Grouped issues opens a single issue for many tests in the same package 1'] = {
  "title": "Spanner: many tests failed",
  "body": "Many tests failed at the same time in this package.\n\n* I will close this issue when there are no more failures in this package _and_\n  there is at least one pass.\n* No new issues will be filed for this package until this issue is closed.\n* If there are already issues for individual test cases, I will close them when\n  the corresponding test passes. You can close them earlier, if you prefer, and\n  I won't reopen them while this issue is still open.\n\nHere are the tests that failed:\n* should delete and then insert rows in the example tables (#8)\n* should query an example table and return matching rows\n* should read an example table\n* should update existing rows in an example table\n* should read stale data from an example table\n* should query an example table with an additional column and return matching rows\n* should query an example table with an index and return matching rows\n* should respect query boundaries when querying an example table with an index\n* should read an example table with an index\n* should read an example table with a storing index\n* should use query options from a database reference\n* should use query options on request\n* should read an example table using transactions\n* should read from and write to an example table using transactions\n* should update existing rows in an example table with commit timestamp column\n* should query an example table with an additional timestamp column and return matching rows\n* should insert rows into an example table with timestamp column\n* should query an example table with a non-null timestamp column and return matching rows\n* should update a row in an example table using a DML statement\n* should delete a row from an example table using a DML statement\n* should update the timestamp of multiple records in an example table using a DML statement\n* should transfer value from one record to another using DML statements within a transaction\n* should update multiple records using a partitioned DML statement\n* should insert and update records using Batch DML\n\n\n-----\ncommit: 123\nbuildURL: http://example.com\nstatus: failed",
  "labels": [
    "type: bug",
    "priority: p1",
    "buildcop: issue"
  ]
}

exports['buildcop app xunitXML Grouped issues closes group issues when all tests pass 1'] = {
  "body": "Test passed for commit 123 (http://example.com)! Closing this issue."
}

exports['buildcop app xunitXML Grouped issues closes group issues when all tests pass 2'] = {
  "state": "closed"
}

exports['buildcop app xunitXML Grouped issues closes group issues when all tests pass 3'] = {
  "body": "Test passed for commit 123 (http://example.com)! Closing this issue."
}

exports['buildcop app xunitXML Grouped issues closes group issues when all tests pass 4'] = {
  "state": "closed"
}

exports['buildcop app xunitXML Grouped issues closes an individual issue and keeps grouped issue open 1'] = {
  "body": "24 tests failed in this package for commit 123 (http://example.com).\n\n-----\ncommit: 123\nbuildURL: http://example.com\nstatus: failed"
}

exports['buildcop app xunitXML Grouped issues closes an individual issue and keeps grouped issue open 2'] = {
  "body": "Test passed for commit 123 (http://example.com)! Closing this issue."
}

exports['buildcop app xunitXML Grouped issues closes an individual issue and keeps grouped issue open 3'] = {
  "state": "closed"
}
