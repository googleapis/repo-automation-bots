# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [1.5.0](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils@0.6.0...gcf-utils@1.5.0) (2020-01-28)


### Bug Fixes

* credentials should not be base64 encoded when stored ([#164](https://github.com/googleapis/repo-automation-bots/issues/164)) ([de31e95](https://github.com/googleapis/repo-automation-bots/commit/de31e95e3d135bb3c75fa6d10c09bb98d7bb4ada))
* improve documentation on using genkey ([#180](https://github.com/googleapis/repo-automation-bots/issues/180)) ([44a7fa3](https://github.com/googleapis/repo-automation-bots/commit/44a7fa32d63e97ca44fbace3f61f8663e72f78a1))
* **deps:** update dependency @google-cloud/storage to v4 ([#129](https://github.com/googleapis/repo-automation-bots/issues/129)) ([1d9893e](https://github.com/googleapis/repo-automation-bots/commit/1d9893e9938afe360f550907ba0d44006f9eb19e))
* **deps:** update dependency @octokit/plugin-enterprise-compatibility to v1.2.1 ([#141](https://github.com/googleapis/repo-automation-bots/issues/141)) ([684eda0](https://github.com/googleapis/repo-automation-bots/commit/684eda073af839099858ccb9c89db43ee70ea579))
* **deps:** update dependency cross-env to v6 ([056fa0b](https://github.com/googleapis/repo-automation-bots/commit/056fa0b1316d20d1cfcf57a9fcaef6a22a55fb66))
* **deps:** update dependency yargs to v14 ([01e5ed9](https://github.com/googleapis/repo-automation-bots/commit/01e5ed98bdac657900ea851fc3cdb7cd6af60ccf))
* **deps:** update dependency yargs to v15 ([#155](https://github.com/googleapis/repo-automation-bots/issues/155)) ([ee4e7e1](https://github.com/googleapis/repo-automation-bots/commit/ee4e7e18e299346f7f2b6b4c2368083bead92d07))
* probot 9.4.0 broke types for apps written in 9.3.0 ([#72](https://github.com/googleapis/repo-automation-bots/issues/72)) ([94999a1](https://github.com/googleapis/repo-automation-bots/commit/94999a1cc9e47380b91a301102aff92dc2b5b6ed))


### Features

* add bot for npm publication through wombat ([#184](https://github.com/googleapis/repo-automation-bots/issues/184)) ([851e77d](https://github.com/googleapis/repo-automation-bots/commit/851e77daf464344a89f0774b9e43142026d6bd8d))
* adds package-lock.json to make upgrades more explicit ([#130](https://github.com/googleapis/repo-automation-bots/issues/130)) ([4be4413](https://github.com/googleapis/repo-automation-bots/commit/4be44137f69165b58c577d348805493924497273))
* improvements to cron functionality ([#167](https://github.com/googleapis/repo-automation-bots/issues/167)) ([f7b2d22](https://github.com/googleapis/repo-automation-bots/commit/f7b2d22fa64b7ff9ccd6536d15fedc84147642b6))
* make gcf-utils work with pubsub ([#196](https://github.com/googleapis/repo-automation-bots/issues/196)) ([5c989b1](https://github.com/googleapis/repo-automation-bots/commit/5c989b113a18abe57c19654a80076d91f631eca6))
* scheduled tasks now execute authenticated for each repository ([#166](https://github.com/googleapis/repo-automation-bots/issues/166)) ([835ab9a](https://github.com/googleapis/repo-automation-bots/commit/835ab9a7c5737a1e66179150e1de5aa28e3d1435))





# [1.1.0](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils@0.6.0...gcf-utils@1.1.0) (2019-11-05)


### Bug Fixes

* **deps:** update dependency @google-cloud/storage to v4 ([#129](https://github.com/googleapis/repo-automation-bots/issues/129)) ([1d9893e](https://github.com/googleapis/repo-automation-bots/commit/1d9893e9938afe360f550907ba0d44006f9eb19e))
* **deps:** update dependency cross-env to v6 ([056fa0b](https://github.com/googleapis/repo-automation-bots/commit/056fa0b1316d20d1cfcf57a9fcaef6a22a55fb66))
* probot 9.4.0 broke types for apps written in 9.3.0 ([#72](https://github.com/googleapis/repo-automation-bots/issues/72)) ([94999a1](https://github.com/googleapis/repo-automation-bots/commit/94999a1cc9e47380b91a301102aff92dc2b5b6ed))
* **deps:** update dependency yargs to v14 ([01e5ed9](https://github.com/googleapis/repo-automation-bots/commit/01e5ed98bdac657900ea851fc3cdb7cd6af60ccf))


### Features

* adds package-lock.json to make upgrades more explicit ([#130](https://github.com/googleapis/repo-automation-bots/issues/130)) ([4be4413](https://github.com/googleapis/repo-automation-bots/commit/4be44137f69165b58c577d348805493924497273))





# [0.6.0](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils@0.4.0...gcf-utils@0.6.0) (2019-08-09)


### Bug Fixes

* allow webhook secret to be specified ([#19](https://github.com/googleapis/repo-automation-bots/issues/19)) ([55d00cf](https://github.com/googleapis/repo-automation-bots/commit/55d00cf))
* upgrade to same version of probot, fixing typings ([#21](https://github.com/googleapis/repo-automation-bots/issues/21)) ([f08869b](https://github.com/googleapis/repo-automation-bots/commit/f08869b))
* **docs:** add appropriate meta information ([#11](https://github.com/googleapis/repo-automation-bots/issues/11)) ([a9c0590](https://github.com/googleapis/repo-automation-bots/commit/a9c0590))


### Features

* lint title if more than 1 commit exists ([#22](https://github.com/googleapis/repo-automation-bots/issues/22)) ([51b74fd](https://github.com/googleapis/repo-automation-bots/commit/51b74fd))
* **gcf-utils:** utility to add/upload probot secrets. ([#18](https://github.com/googleapis/repo-automation-bots/issues/18)) ([d3ddaf2](https://github.com/googleapis/repo-automation-bots/commit/d3ddaf2))





# [0.5.0](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils@0.4.0...gcf-utils@0.5.0) (2019-08-09)


### Bug Fixes

* allow webhook secret to be specified ([#19](https://github.com/googleapis/repo-automation-bots/issues/19)) ([55d00cf](https://github.com/googleapis/repo-automation-bots/commit/55d00cf))
* upgrade to same version of probot, fixing typings ([#21](https://github.com/googleapis/repo-automation-bots/issues/21)) ([f08869b](https://github.com/googleapis/repo-automation-bots/commit/f08869b))
* **docs:** add appropriate meta information ([#11](https://github.com/googleapis/repo-automation-bots/issues/11)) ([a9c0590](https://github.com/googleapis/repo-automation-bots/commit/a9c0590))


### Features

* lint title if more than 1 commit exists ([#22](https://github.com/googleapis/repo-automation-bots/issues/22)) ([51b74fd](https://github.com/googleapis/repo-automation-bots/commit/51b74fd))
* **gcf-utils:** utility to add/upload probot secrets. ([#18](https://github.com/googleapis/repo-automation-bots/issues/18)) ([d3ddaf2](https://github.com/googleapis/repo-automation-bots/commit/d3ddaf2))





### [5.5.1](https://www.github.com/googleapis/repo-automation-bots/compare/v5.5.0...v5.5.1) (2020-08-06)


### Bug Fixes

* **gcf-utils:** Revert binding trigger information to logger ([#809](https://www.github.com/googleapis/repo-automation-bots/issues/809)) ([e9c42b3](https://www.github.com/googleapis/repo-automation-bots/commit/e9c42b3c1e0dafdc05db2e9b1240cb24447de75e)), closes [#796](https://www.github.com/googleapis/repo-automation-bots/issues/796)

## [5.5.0](https://www.github.com/googleapis/repo-automation-bots/compare/v5.4.0...v5.5.0) (2020-08-05)


### Features

* **gcf-utils:** add trigger info as bindings to all log statements ([#796](https://www.github.com/googleapis/repo-automation-bots/issues/796)) ([157c768](https://www.github.com/googleapis/repo-automation-bots/commit/157c768e6de8e3067e24a6dd17be152ae98c25d8))

## [5.4.0](https://www.github.com/googleapis/repo-automation-bots/compare/v5.3.1...v5.4.0) (2020-08-03)


### Features

* **gcf-utils:** log more trigger information ([#788](https://www.github.com/googleapis/repo-automation-bots/issues/788)) ([8a73cca](https://www.github.com/googleapis/repo-automation-bots/commit/8a73ccad2c4a4bc3d9d1dcd0d25d8a6e627921cf))


### Bug Fixes

* **gcf-utils:** log entire errors in specific cases ([#775](https://www.github.com/googleapis/repo-automation-bots/issues/775)) ([ab6fec4](https://www.github.com/googleapis/repo-automation-bots/commit/ab6fec4c9a1d278a015ec00bd24cbefc208ce6f8))
* **merge-on-green:** payload switches between Buffer and object ([#785](https://www.github.com/googleapis/repo-automation-bots/issues/785)) ([43bbd2a](https://www.github.com/googleapis/repo-automation-bots/commit/43bbd2aa199fa6908d4773b7641f4c22b19bacde))

### [5.3.1](https://www.github.com/googleapis/repo-automation-bots/compare/v5.3.0...v5.3.1) (2020-07-28)


### Bug Fixes

* **gcf-utils:** add repository details to payload for pub/sub triggered executions ([#758](https://www.github.com/googleapis/repo-automation-bots/issues/758)) ([00faedc](https://www.github.com/googleapis/repo-automation-bots/commit/00faedc0a3f5d1e4b39bda6fc5371edb2f921d2b))

## [0.4.1](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils@0.4.0...gcf-utils@0.4.1) (2019-07-30)


### Bug Fixes

* **docs:** add appropriate meta information ([#11](https://github.com/googleapis/repo-automation-bots/issues/11)) ([a9c0590](https://github.com/googleapis/repo-automation-bots/commit/a9c0590))





# 0.4.0 (2019-07-30)


### Bug Fixes

* **deps:** update dependency @google-cloud/storage to v3 ([#9](https://github.com//issues/9)) ([1c98b01](https://github.com//commit/1c98b01))
* **lint:** get linting working ([#8](https://github.com//issues/8)) ([70a6bcd](https://github.com//commit/70a6bcd))
* don't use absolute path for gts config ([#3](https://github.com//issues/3)) ([6deba89](https://github.com//commit/6deba89))


### Features

* **infra:** Created bootstrapping infra for GCF ([5ec6d24](https://github.com//commit/5ec6d24))
* added utils for running probot apps in gcf ([#2](https://github.com//issues/2)) ([0032e84](https://github.com//commit/0032e84))





# 0.3.0 (2019-07-30)


### Bug Fixes

* **deps:** update dependency @google-cloud/storage to v3 ([#9](https://github.com//issues/9)) ([1c98b01](https://github.com//commit/1c98b01))
* **lint:** get linting working ([#8](https://github.com//issues/8)) ([70a6bcd](https://github.com//commit/70a6bcd))
* don't use absolute path for gts config ([#3](https://github.com//issues/3)) ([6deba89](https://github.com//commit/6deba89))


### Features

* **infra:** Created bootstrapping infra for GCF ([5ec6d24](https://github.com//commit/5ec6d24))
* added utils for running probot apps in gcf ([#2](https://github.com//issues/2)) ([0032e84](https://github.com//commit/0032e84))





# 0.2.0 (2019-07-30)


### Bug Fixes

* **deps:** update dependency @google-cloud/storage to v3 ([#9](https://github.com//issues/9)) ([1c98b01](https://github.com//commit/1c98b01))
* **lint:** get linting working ([#8](https://github.com//issues/8)) ([70a6bcd](https://github.com//commit/70a6bcd))
* don't use absolute path for gts config ([#3](https://github.com//issues/3)) ([6deba89](https://github.com//commit/6deba89))


### Features

* **infra:** Created bootstrapping infra for GCF ([5ec6d24](https://github.com//commit/5ec6d24))
* added utils for running probot apps in gcf ([#2](https://github.com//issues/2)) ([0032e84](https://github.com//commit/0032e84))
