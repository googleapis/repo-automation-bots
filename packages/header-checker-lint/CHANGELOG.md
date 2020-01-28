# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# 1.2.0 (2020-01-28)


### Bug Fixes

* ensure header check ignores deleted files ([#223](https://github.com/googleapis/repo-automation-bots/issues/223)) ([a58e3d0](https://github.com/googleapis/repo-automation-bots/commit/a58e3d08ddc6fc5450077df44bb674847e2e9e16))
* **header-checker-lint:** allow for copyright date ranges ([#208](https://github.com/googleapis/repo-automation-bots/issues/208)) ([c4fd110](https://github.com/googleapis/repo-automation-bots/commit/c4fd1100e17c062164507983c910036fc75fc197))
* don't enforce ALLOWED_COPYRIGHT_HOLDERS on updates (yet) ([#30](https://github.com/googleapis/repo-automation-bots/issues/30)) ([f546f76](https://github.com/googleapis/repo-automation-bots/commit/f546f76555f16a4deada7053d88bf2b4fa19364b))
* header-checker-lint regex escape char ([#26](https://github.com/googleapis/repo-automation-bots/issues/26)) ([bca613d](https://github.com/googleapis/repo-automation-bots/commit/bca613de0ed04bc4126d4e5446b7784074f61ee7))
* loosen copyright regex ([#42](https://github.com/googleapis/repo-automation-bots/issues/42)) ([847c5f9](https://github.com/googleapis/repo-automation-bots/commit/847c5f9552d9a820f92a4a31771d8e5524ad67d1))
* undo screw up ([8b27258](https://github.com/googleapis/repo-automation-bots/commit/8b2725885376dc10e3d663dfd541e0df972cff85))
* **deps:** update dependency @octokit/plugin-enterprise-compatibility to v1.2.1 ([#141](https://github.com/googleapis/repo-automation-bots/issues/141)) ([684eda0](https://github.com/googleapis/repo-automation-bots/commit/684eda073af839099858ccb9c89db43ee70ea579))
* match copyright line in comments only ([#33](https://github.com/googleapis/repo-automation-bots/issues/33)) ([6fc061a](https://github.com/googleapis/repo-automation-bots/commit/6fc061aa54db6b2cc50d0d28a32c7c957f832f81))
* pinned dependency to octokit/rest to 16.28.3 ([#89](https://github.com/googleapis/repo-automation-bots/issues/89)) ([abe95db](https://github.com/googleapis/repo-automation-bots/commit/abe95dbd34e573336530c0d413ac925b2d084b2a))
* **deps:** update dependency cross-env to v6 ([056fa0b](https://github.com/googleapis/repo-automation-bots/commit/056fa0b1316d20d1cfcf57a9fcaef6a22a55fb66))
* add minimatch dependencies to header-checker-lint ([#39](https://github.com/googleapis/repo-automation-bots/issues/39)) ([f5e887e](https://github.com/googleapis/repo-automation-bots/commit/f5e887e7ce429e8e2ae048b1f5a2ea6163c56a5a))
* copyright detection ([#43](https://github.com/googleapis/repo-automation-bots/issues/43)) ([1f5abf6](https://github.com/googleapis/repo-automation-bots/commit/1f5abf6b9e9aed9536e793d48ce7044347fe48d8))
* probot 9.4.0 broke types for apps written in 9.3.0 ([#72](https://github.com/googleapis/repo-automation-bots/issues/72)) ([94999a1](https://github.com/googleapis/repo-automation-bots/commit/94999a1cc9e47380b91a301102aff92dc2b5b6ed))


### Features

* add BSD 3-clause detection ([#35](https://github.com/googleapis/repo-automation-bots/issues/35)) ([3bd2d0d](https://github.com/googleapis/repo-automation-bots/commit/3bd2d0d649af263138b8dad2c613a001b95ca9ae))
* add header-checker-lint bot ([#23](https://github.com/googleapis/repo-automation-bots/issues/23)) ([05170ad](https://github.com/googleapis/repo-automation-bots/commit/05170ad37d982ad3ea7ebbdf93bc8a6c7b3c9558))
* add header-checker-lint options file ([#34](https://github.com/googleapis/repo-automation-bots/issues/34)) ([f8d0743](https://github.com/googleapis/repo-automation-bots/commit/f8d07433fbae61576f9407964256b99af4d6e10b))
* adds package-lock.json to make upgrades more explicit ([#130](https://github.com/googleapis/repo-automation-bots/issues/130)) ([4be4413](https://github.com/googleapis/repo-automation-bots/commit/4be44137f69165b58c577d348805493924497273))
* allow BSD license ([#148](https://github.com/googleapis/repo-automation-bots/issues/148)) ([7188375](https://github.com/googleapis/repo-automation-bots/commit/7188375d9e0e71d1bea50c8d7395a7af49409d3d))
* ignore configured ignoreFiles globs ([#37](https://github.com/googleapis/repo-automation-bots/issues/37)) ([858fdea](https://github.com/googleapis/repo-automation-bots/commit/858fdea923b142b3c6f6e251286e6b721b98387e))
* **header-checker-lint:** improve copyright lint detection ([#27](https://github.com/googleapis/repo-automation-bots/issues/27)) ([5aa976e](https://github.com/googleapis/repo-automation-bots/commit/5aa976e0130289c34772807483bda6ef1b02af86))





# 1.1.0 (2019-11-05)


### Bug Fixes

* pinned dependency to octokit/rest to 16.28.3 ([#89](https://github.com/googleapis/repo-automation-bots/issues/89)) ([abe95db](https://github.com/googleapis/repo-automation-bots/commit/abe95dbd34e573336530c0d413ac925b2d084b2a))
* **deps:** update dependency cross-env to v6 ([056fa0b](https://github.com/googleapis/repo-automation-bots/commit/056fa0b1316d20d1cfcf57a9fcaef6a22a55fb66))
* add minimatch dependencies to header-checker-lint ([#39](https://github.com/googleapis/repo-automation-bots/issues/39)) ([f5e887e](https://github.com/googleapis/repo-automation-bots/commit/f5e887e7ce429e8e2ae048b1f5a2ea6163c56a5a))
* copyright detection ([#43](https://github.com/googleapis/repo-automation-bots/issues/43)) ([1f5abf6](https://github.com/googleapis/repo-automation-bots/commit/1f5abf6b9e9aed9536e793d48ce7044347fe48d8))
* don't enforce ALLOWED_COPYRIGHT_HOLDERS on updates (yet) ([#30](https://github.com/googleapis/repo-automation-bots/issues/30)) ([f546f76](https://github.com/googleapis/repo-automation-bots/commit/f546f76555f16a4deada7053d88bf2b4fa19364b))
* header-checker-lint regex escape char ([#26](https://github.com/googleapis/repo-automation-bots/issues/26)) ([bca613d](https://github.com/googleapis/repo-automation-bots/commit/bca613de0ed04bc4126d4e5446b7784074f61ee7))
* loosen copyright regex ([#42](https://github.com/googleapis/repo-automation-bots/issues/42)) ([847c5f9](https://github.com/googleapis/repo-automation-bots/commit/847c5f9552d9a820f92a4a31771d8e5524ad67d1))
* match copyright line in comments only ([#33](https://github.com/googleapis/repo-automation-bots/issues/33)) ([6fc061a](https://github.com/googleapis/repo-automation-bots/commit/6fc061aa54db6b2cc50d0d28a32c7c957f832f81))
* probot 9.4.0 broke types for apps written in 9.3.0 ([#72](https://github.com/googleapis/repo-automation-bots/issues/72)) ([94999a1](https://github.com/googleapis/repo-automation-bots/commit/94999a1cc9e47380b91a301102aff92dc2b5b6ed))


### Features

* add BSD 3-clause detection ([#35](https://github.com/googleapis/repo-automation-bots/issues/35)) ([3bd2d0d](https://github.com/googleapis/repo-automation-bots/commit/3bd2d0d649af263138b8dad2c613a001b95ca9ae))
* add header-checker-lint bot ([#23](https://github.com/googleapis/repo-automation-bots/issues/23)) ([05170ad](https://github.com/googleapis/repo-automation-bots/commit/05170ad37d982ad3ea7ebbdf93bc8a6c7b3c9558))
* add header-checker-lint options file ([#34](https://github.com/googleapis/repo-automation-bots/issues/34)) ([f8d0743](https://github.com/googleapis/repo-automation-bots/commit/f8d07433fbae61576f9407964256b99af4d6e10b))
* adds package-lock.json to make upgrades more explicit ([#130](https://github.com/googleapis/repo-automation-bots/issues/130)) ([4be4413](https://github.com/googleapis/repo-automation-bots/commit/4be44137f69165b58c577d348805493924497273))
* ignore configured ignoreFiles globs ([#37](https://github.com/googleapis/repo-automation-bots/issues/37)) ([858fdea](https://github.com/googleapis/repo-automation-bots/commit/858fdea923b142b3c6f6e251286e6b721b98387e))
* **header-checker-lint:** improve copyright lint detection ([#27](https://github.com/googleapis/repo-automation-bots/issues/27)) ([5aa976e](https://github.com/googleapis/repo-automation-bots/commit/5aa976e0130289c34772807483bda6ef1b02af86))
