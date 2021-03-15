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
