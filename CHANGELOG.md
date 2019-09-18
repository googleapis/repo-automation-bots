# Changelog

## 1.0.0 (2019-09-18)


### Bug Fixes

* add minimatch dependencies to header-checker-lint ([#39](https://www.github.com/googleapis/repo-automation-bots/issues/39)) ([f5e887e](https://www.github.com/googleapis/repo-automation-bots/commit/f5e887e))
* **deps:** update dependency yargs to v14 ([01e5ed9](https://www.github.com/googleapis/repo-automation-bots/commit/01e5ed9))
* adds missing slash to cloudbuild ([#78](https://www.github.com/googleapis/repo-automation-bots/issues/78)) ([d66222e](https://www.github.com/googleapis/repo-automation-bots/commit/d66222e))
* allow up to 256 characters in description ([#48](https://www.github.com/googleapis/repo-automation-bots/issues/48)) ([706f34c](https://www.github.com/googleapis/repo-automation-bots/commit/706f34c))
* allow webhook secret to be specified ([#19](https://www.github.com/googleapis/repo-automation-bots/issues/19)) ([55d00cf](https://www.github.com/googleapis/repo-automation-bots/commit/55d00cf))
* blunderbuss ignores missing configs ([#47](https://www.github.com/googleapis/repo-automation-bots/issues/47)) ([90b4a09](https://www.github.com/googleapis/repo-automation-bots/commit/90b4a09))
* cloudbuild needs to compile before deploying ([#24](https://www.github.com/googleapis/repo-automation-bots/issues/24)) ([b7c2e19](https://www.github.com/googleapis/repo-automation-bots/commit/b7c2e19))
* copyright detection ([#43](https://www.github.com/googleapis/repo-automation-bots/issues/43)) ([1f5abf6](https://www.github.com/googleapis/repo-automation-bots/commit/1f5abf6))
* declare semver dependency explicitly ([#64](https://www.github.com/googleapis/repo-automation-bots/issues/64)) ([a6d43ad](https://www.github.com/googleapis/repo-automation-bots/commit/a6d43ad))
* don't enforce ALLOWED_COPYRIGHT_HOLDERS on updates (yet) ([#30](https://www.github.com/googleapis/repo-automation-bots/issues/30)) ([f546f76](https://www.github.com/googleapis/repo-automation-bots/commit/f546f76))
* don't use absolute path for gts config ([#3](https://www.github.com/googleapis/repo-automation-bots/issues/3)) ([6deba89](https://www.github.com/googleapis/repo-automation-bots/commit/6deba89))
* fixed args in proxy builder ([#70](https://www.github.com/googleapis/repo-automation-bots/issues/70)) ([2894844](https://www.github.com/googleapis/repo-automation-bots/commit/2894844))
* header-checker-lint regex escape char ([#26](https://www.github.com/googleapis/repo-automation-bots/issues/26)) ([bca613d](https://www.github.com/googleapis/repo-automation-bots/commit/bca613d))
* loosen copyright regex ([#42](https://www.github.com/googleapis/repo-automation-bots/issues/42)) ([847c5f9](https://www.github.com/googleapis/repo-automation-bots/commit/847c5f9))
* match copyright line in comments only ([#33](https://www.github.com/googleapis/repo-automation-bots/issues/33)) ([6fc061a](https://www.github.com/googleapis/repo-automation-bots/commit/6fc061a))
* probot 9.4.0 broke types for apps written in 9.3.0 ([#72](https://www.github.com/googleapis/repo-automation-bots/issues/72)) ([94999a1](https://www.github.com/googleapis/repo-automation-bots/commit/94999a1))
* release-please bot entrypoint name ([#65](https://www.github.com/googleapis/repo-automation-bots/issues/65)) ([68e3667](https://www.github.com/googleapis/repo-automation-bots/commit/68e3667))
* update release-please to 2.9.0 ([#75](https://www.github.com/googleapis/repo-automation-bots/issues/75)) ([2ebe849](https://www.github.com/googleapis/repo-automation-bots/commit/2ebe849))
* upgrade to same version of probot, fixing typings ([#21](https://www.github.com/googleapis/repo-automation-bots/issues/21)) ([f08869b](https://www.github.com/googleapis/repo-automation-bots/commit/f08869b))
* **build:** add subcommand to get proxyurl ([#76](https://www.github.com/googleapis/repo-automation-bots/issues/76)) ([413af5b](https://www.github.com/googleapis/repo-automation-bots/commit/413af5b))
* **deps:** update dependency @google-cloud/storage to v3 ([#9](https://www.github.com/googleapis/repo-automation-bots/issues/9)) ([1c98b01](https://www.github.com/googleapis/repo-automation-bots/commit/1c98b01))
* **docs:** add appropriate meta information ([#11](https://www.github.com/googleapis/repo-automation-bots/issues/11)) ([a9c0590](https://www.github.com/googleapis/repo-automation-bots/commit/a9c0590))
* **lint:** get linting working ([#8](https://www.github.com/googleapis/repo-automation-bots/issues/8)) ([70a6bcd](https://www.github.com/googleapis/repo-automation-bots/commit/70a6bcd))
* **serverless-scheduler-proxy:** fix sign header ([#71](https://www.github.com/googleapis/repo-automation-bots/issues/71)) ([05ffbf3](https://www.github.com/googleapis/repo-automation-bots/commit/05ffbf3))


### Features

* add BSD 3-clause detection ([#35](https://www.github.com/googleapis/repo-automation-bots/issues/35)) ([3bd2d0d](https://www.github.com/googleapis/repo-automation-bots/commit/3bd2d0d))
* add header-checker-lint bot ([#23](https://www.github.com/googleapis/repo-automation-bots/issues/23)) ([05170ad](https://www.github.com/googleapis/repo-automation-bots/commit/05170ad))
* add header-checker-lint options file ([#34](https://www.github.com/googleapis/repo-automation-bots/issues/34)) ([f8d0743](https://www.github.com/googleapis/repo-automation-bots/commit/f8d0743))
* add release-please bot ([#29](https://www.github.com/googleapis/repo-automation-bots/issues/29)) ([6323f53](https://www.github.com/googleapis/repo-automation-bots/commit/6323f53))
* added utils for running probot apps in gcf ([#2](https://www.github.com/googleapis/repo-automation-bots/issues/2)) ([0032e84](https://www.github.com/googleapis/repo-automation-bots/commit/0032e84))
* **header-checker-lint:** improve copyright lint detection ([#27](https://www.github.com/googleapis/repo-automation-bots/issues/27)) ([5aa976e](https://www.github.com/googleapis/repo-automation-bots/commit/5aa976e))
* adding an example conventional commit bot ([#1](https://www.github.com/googleapis/repo-automation-bots/issues/1)) ([5555632](https://www.github.com/googleapis/repo-automation-bots/commit/5555632))
* adding new blunderbuss bot for assigning issues and prs ([#44](https://www.github.com/googleapis/repo-automation-bots/issues/44)) ([0493750](https://www.github.com/googleapis/repo-automation-bots/commit/0493750))
* **build:** Set proper substitution values in cloudbuild.yaml ([#14](https://www.github.com/googleapis/repo-automation-bots/issues/14)) ([918fddc](https://www.github.com/googleapis/repo-automation-bots/commit/918fddc))
* **gcf-utils:** utility to add/upload probot secrets. ([#18](https://www.github.com/googleapis/repo-automation-bots/issues/18)) ([d3ddaf2](https://www.github.com/googleapis/repo-automation-bots/commit/d3ddaf2))
* adds infrastructure for Cron Bots ([#67](https://www.github.com/googleapis/repo-automation-bots/issues/67)) ([c547759](https://www.github.com/googleapis/repo-automation-bots/commit/c547759))
* ignore configured ignoreFiles globs ([#37](https://www.github.com/googleapis/repo-automation-bots/issues/37)) ([858fdea](https://www.github.com/googleapis/repo-automation-bots/commit/858fdea))
* lint title if more than 1 commit exists ([#22](https://www.github.com/googleapis/repo-automation-bots/issues/22)) ([51b74fd](https://www.github.com/googleapis/repo-automation-bots/commit/51b74fd))
* make release-please opt-in ([#69](https://www.github.com/googleapis/repo-automation-bots/issues/69)) ([540c9f9](https://www.github.com/googleapis/repo-automation-bots/commit/540c9f9))
