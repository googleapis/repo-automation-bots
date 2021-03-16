exports['Runner createBranch creates a branch 1'] = {
  "ref": "refs/heads/1.x",
  "sha": "abcd1234"
}

exports['Runner updateReleasePleaseConfig with releaseType updates a basic config 1'] = `
releaseType: java-yoshi
bumpMinorPreMajor: true
branches:
  - releaseType: custom-releaser
    bumpMinorPreMajor: true
    branch: 1.x

`

exports['Runner updateReleasePleaseConfig with releaseType updates a config with extra branches already configured 1'] = `
releaseType: java-yoshi
bumpMinorPreMajor: true
branches:
  - branch: 3.1.x
    releaseType: java-yoshi
    bumpMinorPreMajor: true
  - releaseType: custom-releaser
    bumpMinorPreMajor: true
    branch: 1.x

`

exports['Runner updateReleasePleaseConfig without releaseType updates a basic config 1'] = `
releaseType: java-yoshi
bumpMinorPreMajor: true
branches:
  - releaseType: java-yoshi
    bumpMinorPreMajor: true
    branch: 1.x

`

exports['Runner updateReleasePleaseConfig without releaseType updates a config with extra branches already configured 1'] = `
releaseType: java-yoshi
bumpMinorPreMajor: true
branches:
  - branch: 3.1.x
    releaseType: java-yoshi
    bumpMinorPreMajor: true
  - releaseType: java-yoshi
    bumpMinorPreMajor: true
    branch: 1.x

`

exports['Runner updateSyncRepoSettings updates a basic config 1'] = `
rebaseMergeAllowed: false
squashMergeAllowed: true
mergeCommitAllowed: false
branchProtectionRules:
  - pattern: master
    isAdminEnforced: true
    requiredApprovingReviewCount: 1
    requiresCodeOwnerReviews: true
    requiresStrictStatusChecks: false
    requiredStatusCheckContexts:
      - dependencies (8)
      - dependencies (11)
      - linkage-monitor
      - lint
      - clirr
      - units (7)
      - units (8)
      - units (11)
      - 'Kokoro - Test: Integration'
      - cla/google
  - pattern: 1.x
    isAdminEnforced: true
    requiredApprovingReviewCount: 1
    requiresCodeOwnerReviews: true
    requiresStrictStatusChecks: false
    requiredStatusCheckContexts:
      - dependencies (8)
      - dependencies (11)
      - linkage-monitor
      - lint
      - clirr
      - units (7)
      - units (8)
      - units (11)
      - 'Kokoro - Test: Integration'
      - cla/google
permissionRules:
  - team: yoshi-admins
    permission: admin
  - team: yoshi-java-admins
    permission: admin
  - team: yoshi-java
    permission: push

`

exports['Runner updateSyncRepoSettings updates a config with extra branches already configured 1'] = `
rebaseMergeAllowed: false
squashMergeAllowed: true
mergeCommitAllowed: false
branchProtectionRules:
  - pattern: master
    isAdminEnforced: true
    requiredApprovingReviewCount: 1
    requiresCodeOwnerReviews: true
    requiresStrictStatusChecks: false
    requiredStatusCheckContexts:
      - dependencies (8)
      - dependencies (11)
      - linkage-monitor
      - lint
      - clirr
      - units (7)
      - units (8)
      - units (11)
      - 'Kokoro - Test: Integration'
      - cla/google
  - pattern: 3.1.x
    isAdminEnforced: true
    requiredApprovingReviewCount: 1
    requiresCodeOwnerReviews: true
    requiresStrictStatusChecks: false
    requiredStatusCheckContexts:
      - dependencies (8)
      - dependencies (11)
      - linkage-monitor
      - lint
      - clirr
      - units (7)
      - units (8)
      - units (11)
      - 'Kokoro - Test: Integration'
      - cla/google
  - pattern: 1.x
    isAdminEnforced: true
    requiredApprovingReviewCount: 1
    requiresCodeOwnerReviews: true
    requiresStrictStatusChecks: false
    requiredStatusCheckContexts:
      - dependencies (8)
      - dependencies (11)
      - linkage-monitor
      - lint
      - clirr
      - units (7)
      - units (8)
      - units (11)
      - 'Kokoro - Test: Integration'
      - cla/google
permissionRules:
  - team: yoshi-admins
    permission: admin
  - team: yoshi-java-admins
    permission: admin
  - team: yoshi-java
    permission: push

`

exports['pr-changes'] = [
  [
    ".github/release-please.yml",
    {
      "mode": "100644",
      "content": "releaseType: java-yoshi\nbumpMinorPreMajor: true\nbranches:\n  - releaseType: java-yoshi\n    bumpMinorPreMajor: true\n    branch: 1.x\n"
    }
  ],
  [
    ".github/sync-repo-settings.yaml",
    {
      "mode": "100644",
      "content": "rebaseMergeAllowed: false\nsquashMergeAllowed: true\nmergeCommitAllowed: false\nbranchProtectionRules:\n  - pattern: master\n    isAdminEnforced: true\n    requiredApprovingReviewCount: 1\n    requiresCodeOwnerReviews: true\n    requiresStrictStatusChecks: false\n    requiredStatusCheckContexts:\n      - dependencies (8)\n      - dependencies (11)\n      - linkage-monitor\n      - lint\n      - clirr\n      - units (7)\n      - units (8)\n      - units (11)\n      - 'Kokoro - Test: Integration'\n      - cla/google\n  - pattern: 1.x\n    isAdminEnforced: true\n    requiredApprovingReviewCount: 1\n    requiresCodeOwnerReviews: true\n    requiresStrictStatusChecks: false\n    requiredStatusCheckContexts:\n      - dependencies (8)\n      - dependencies (11)\n      - linkage-monitor\n      - lint\n      - clirr\n      - units (7)\n      - units (8)\n      - units (11)\n      - 'Kokoro - Test: Integration'\n      - cla/google\npermissionRules:\n  - team: yoshi-admins\n    permission: admin\n  - team: yoshi-java-admins\n    permission: admin\n  - team: yoshi-java\n    permission: push\n"
    }
  ]
]

exports['pr-options'] = {
  "upstreamRepo": "testRepo",
  "upstreamOwner": "testOwner",
  "message": "build: configure branch 1.x as a release branch",
  "title": "build: configure branch 1.x as a release branch",
  "description": "enable releases",
  "branch": "release-brancher/1.x",
  "force": true,
  "fork": false
}
