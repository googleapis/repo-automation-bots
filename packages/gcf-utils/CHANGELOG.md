# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [1.5.0](https://github.com/googleapis/repo-automation-bots/) (2020-01-28)


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





# [0.5.0](https://github.com/googleapis/repo-automation-bots/) (2019-08-09)


### Bug Fixes

* allow webhook secret to be specified ([#19](https://github.com/googleapis/repo-automation-bots/issues/19)) ([55d00cf](https://github.com/googleapis/repo-automation-bots/commit/55d00cf))
* upgrade to same version of probot, fixing typings ([#21](https://github.com/googleapis/repo-automation-bots/issues/21)) ([f08869b](https://github.com/googleapis/repo-automation-bots/commit/f08869b))
* **docs:** add appropriate meta information ([#11](https://github.com/googleapis/repo-automation-bots/issues/11)) ([a9c0590](https://github.com/googleapis/repo-automation-bots/commit/a9c0590))


### Features

* lint title if more than 1 commit exists ([#22](https://github.com/googleapis/repo-automation-bots/issues/22)) ([51b74fd](https://github.com/googleapis/repo-automation-bots/commit/51b74fd))
* **gcf-utils:** utility to add/upload probot secrets. ([#18](https://github.com/googleapis/repo-automation-bots/issues/18)) ([d3ddaf2](https://github.com/googleapis/repo-automation-bots/commit/d3ddaf2))





### [8.0.1](https://www.github.com/googleapis/repo-automation-bots/compare/gcf-utils-v8.0.0...gcf-utils-v8.0.1) (2021-05-24)


### Bug Fixes

* **gcf-utils:** skip archived repository for scheduler task ([#1853](https://www.github.com/googleapis/repo-automation-bots/issues/1853)) ([706c502](https://www.github.com/googleapis/repo-automation-bots/commit/706c50267690924298a565a46ad62c290bf2f655))

## [8.0.0](https://www.github.com/googleapis/repo-automation-bots/compare/gcf-utils-v7.2.2...gcf-utils-v8.0.0) (2021-05-21)


### ⚠ BREAKING CHANGES

* **gcf-utils:** fix getAuthenticatedOctokit (#1826)

### Bug Fixes

* **gcf-utils:** fix getAuthenticatedOctokit ([#1826](https://www.github.com/googleapis/repo-automation-bots/issues/1826)) ([c602f0f](https://www.github.com/googleapis/repo-automation-bots/commit/c602f0f8de126173c6a0e13fb3b7942cc732df84))

### [7.2.2](https://www.github.com/googleapis/repo-automation-bots/compare/gcf-utils-v7.2.1...gcf-utils-v7.2.2) (2021-04-23)


### Bug Fixes

* **deps:** update dependency @octokit/plugin-enterprise-compatibility to v1.2.11 ([#1667](https://www.github.com/googleapis/repo-automation-bots/issues/1667)) ([f2ee62a](https://www.github.com/googleapis/repo-automation-bots/commit/f2ee62ac69397bdbaf69ba2c2136b6d782aa4185))

### [7.2.1](https://www.github.com/googleapis/repo-automation-bots/compare/gcf-utils-v7.2.0...gcf-utils-v7.2.1) (2021-04-21)


### Bug Fixes

* **gcf-utils:** address octokit type regressions ([#1660](https://www.github.com/googleapis/repo-automation-bots/issues/1660)) ([79f7c3f](https://www.github.com/googleapis/repo-automation-bots/commit/79f7c3f0a875b187e170a4bf50f0235d02a02230))

## [7.2.0](https://www.github.com/googleapis/repo-automation-bots/compare/gcf-utils-v7.1.4...gcf-utils-v7.2.0) (2021-04-21)


### Features

* **gcf-utils:** extend logger to populate count/event/type ([#1655](https://www.github.com/googleapis/repo-automation-bots/issues/1655)) ([c3f8f11](https://www.github.com/googleapis/repo-automation-bots/commit/c3f8f11d253401a93d9a89d778a39577c50be03a))

### [7.1.4](https://www.github.com/googleapis/repo-automation-bots/compare/gcf-utils-v7.1.3...gcf-utils-v7.1.4) (2021-03-24)


### Bug Fixes

* **deps:** update dependency @octokit/plugin-enterprise-compatibility to v1.2.10 ([#1518](https://www.github.com/googleapis/repo-automation-bots/issues/1518)) ([6e6d40b](https://www.github.com/googleapis/repo-automation-bots/commit/6e6d40b2eed46ee13e9272654a3097f81a83ee8f))

### [7.1.3](https://www.github.com/googleapis/repo-automation-bots/compare/v7.1.2...v7.1.3) (2021-03-01)


### Bug Fixes

* authenticate octokit instance properly when receiving payload from cloud scheduler ([#1461](https://www.github.com/googleapis/repo-automation-bots/issues/1461)) ([c968d8a](https://www.github.com/googleapis/repo-automation-bots/commit/c968d8aa83f8175b0ba942e3fceed3f27ddc78a9))

### [7.1.2](https://www.github.com/googleapis/repo-automation-bots/compare/v7.1.1...v7.1.2) (2021-02-11)


### Bug Fixes

* **owl-bot:** fix two timing related bugs ([#1413](https://www.github.com/googleapis/repo-automation-bots/issues/1413)) ([8a60f32](https://www.github.com/googleapis/repo-automation-bots/commit/8a60f3214a2499a8a34285eead81b60f0b86a745))

### [7.1.1](https://www.github.com/googleapis/repo-automation-bots/compare/v7.0.2...v7.1.1) (2021-02-05)


### Bug Fixes

* **gcf-utils:** release as appropriate version ([#1371](https://www.github.com/googleapis/repo-automation-bots/issues/1371)) ([730be51](https://www.github.com/googleapis/repo-automation-bots/commit/730be51d37b584aff02c1725ea04dd7f3f69c726))

### [7.0.2](https://www.github.com/googleapis/repo-automation-bots/) (2021-02-05)


### Bug Fixes

* update secret values for old bots ([#1365](https://www.github.com/googleapis/repo-automation-bots/issues/1365)) ([e88a323](https://www.github.com/googleapis/repo-automation-bots/commit/e88a32367d018dd9973a6b898ca7f7f801b23de4))

### [7.0.1](https://www.github.com/googleapis/repo-automation-bots/) (2021-02-03)


### Bug Fixes

* **deps:** update dependency @octokit/plugin-enterprise-compatibility to v1.2.9 ([#1327](https://www.github.com/googleapis/repo-automation-bots/issues/1327)) ([2dfc220](https://www.github.com/googleapis/repo-automation-bots/commit/2dfc2202b93aad752a34954650551eed0e235b64))
* **deps:** update dependency probot to v11.0.5 ([#1295](https://www.github.com/googleapis/repo-automation-bots/issues/1295)) ([36e9880](https://www.github.com/googleapis/repo-automation-bots/commit/36e9880ff3fc04336eb8035d33ea4b64e85ab7a4))
* **gcf-utils:** upgrade to Probot 11, with e2e deployment test ([#1345](https://www.github.com/googleapis/repo-automation-bots/issues/1345)) ([07418a2](https://www.github.com/googleapis/repo-automation-bots/commit/07418a2cdc2075786af15524a3f3828c3df4807e))

## [7.0.0](https://www.github.com/googleapis/repo-automation-bots/compare/v6.3.2...v7.0.0) (2021-01-20)


### ⚠ BREAKING CHANGES

* **deps:** update dependency probot to v11.0.4 (#1285)

### Bug Fixes

* **deps:** update dependency probot to v11.0.4 ([#1285](https://www.github.com/googleapis/repo-automation-bots/issues/1285)) ([3191159](https://www.github.com/googleapis/repo-automation-bots/commit/31911594187c924fa50fdf88d2208f075b4fb8f6))

### [6.3.2](https://www.github.com/googleapis/repo-automation-bots/) (2021-01-20)


### Bug Fixes

* **deps:** update dependency probot to v11.0.3 ([#1284](https://www.github.com/googleapis/repo-automation-bots/issues/1284)) ([ea5ef00](https://www.github.com/googleapis/repo-automation-bots/commit/ea5ef00364ee1ffdebd9f7164e787fb77419b4e6))
* **deps:** upgrade to Probot 11 ([#1280](https://www.github.com/googleapis/repo-automation-bots/issues/1280)) ([6abbbed](https://www.github.com/googleapis/repo-automation-bots/commit/6abbbed3fc7410b0e416e1823c4512490b2ca9ea))

### [6.3.1](https://www.github.com/googleapis/repo-automation-bots/) (2021-01-06)


### Bug Fixes

* **deps:** update dependency @octokit/plugin-enterprise-compatibility to v1.2.8 ([#1203](https://www.github.com/googleapis/repo-automation-bots/issues/1203)) ([6216b5c](https://www.github.com/googleapis/repo-automation-bots/commit/6216b5c0e2dd7eeb0a2c4e903d4c83589c87d8f6))

## [6.3.0](https://www.github.com/googleapis/repo-automation-bots/compare/v6.2.0...v6.3.0) (2020-12-02)


### Features

* **gcf-utils:** export a function for the comment mark ([#1173](https://www.github.com/googleapis/repo-automation-bots/issues/1173)) ([90981e4](https://www.github.com/googleapis/repo-automation-bots/commit/90981e4e1146e8038e9d532862926682c2ec9a26)), closes [#1160](https://www.github.com/googleapis/repo-automation-bots/issues/1160)


### Bug Fixes

* **deps:** update dependency @octokit/plugin-enterprise-compatibility to v1.2.7 ([#1194](https://www.github.com/googleapis/repo-automation-bots/issues/1194)) ([9d07382](https://www.github.com/googleapis/repo-automation-bots/commit/9d073824696f858a820b24496385eb9b295d4ee1))

## [6.2.0](https://www.github.com/googleapis/repo-automation-bots/compare/v6.1.4...v6.2.0) (2020-11-18)


### Features

* **gcf-utils:** add addOrUpdateIssueComment ([#1118](https://www.github.com/googleapis/repo-automation-bots/issues/1118)) ([448243f](https://www.github.com/googleapis/repo-automation-bots/commit/448243f00c84e7535d63d253777858fd22baf7a3)), closes [#1114](https://www.github.com/googleapis/repo-automation-bots/issues/1114)
* **gcf-utils:** change the method signature of addOrUpdateIssueComment ([#1131](https://www.github.com/googleapis/repo-automation-bots/issues/1131)) ([700927f](https://www.github.com/googleapis/repo-automation-bots/commit/700927fc4667d29afeaa60a1acdc47a557bcc9d5)), closes [#1130](https://www.github.com/googleapis/repo-automation-bots/issues/1130)

### [6.1.4](https://www.github.com/googleapis/repo-automation-bots/compare/v6.1.3...v6.1.4) (2020-11-03)


### Bug Fixes

* **deps:** update dependency @octokit/plugin-enterprise-compatibility to v1.2.6 ([#1069](https://www.github.com/googleapis/repo-automation-bots/issues/1069)) ([1c0fb97](https://www.github.com/googleapis/repo-automation-bots/commit/1c0fb97e7e2420d13b251fa0e1bbeaca0873a35b))

### [6.1.3](https://www.github.com/googleapis/repo-automation-bots/compare/v6.1.2...v6.1.3) (2020-10-28)


### Bug Fixes

* **probot:** latest release of probot breaks auth ([#1063](https://www.github.com/googleapis/repo-automation-bots/issues/1063)) ([e32e8da](https://www.github.com/googleapis/repo-automation-bots/commit/e32e8daeb591cc10db537e9bf990c255ed95dae7))

### [6.1.2](https://www.github.com/googleapis/repo-automation-bots/compare/v6.1.1...v6.1.2) (2020-10-26)


### Bug Fixes

* **deps:** update dependency gaxios to v4 ([#1049](https://www.github.com/googleapis/repo-automation-bots/issues/1049)) ([1301f76](https://www.github.com/googleapis/repo-automation-bots/commit/1301f7665ea6781f880dfb3213b8716fafd28df1))

### [6.1.1](https://www.github.com/googleapis/repo-automation-bots/compare/v6.1.0...v6.1.1) (2020-10-01)


### Bug Fixes

* **logger:** allow log methods to be used in isolation ([#997](https://www.github.com/googleapis/repo-automation-bots/issues/997)) ([38371ca](https://www.github.com/googleapis/repo-automation-bots/commit/38371cae7aaf48b4ba5effab453dfac332f912bd))

## [6.1.0](https://www.github.com/googleapis/repo-automation-bots/compare/v6.0.0...v6.1.0) (2020-09-30)


### Features

* **gcf-utils:** write payload to tmp bucket ([#983](https://www.github.com/googleapis/repo-automation-bots/issues/983)) ([38f264e](https://www.github.com/googleapis/repo-automation-bots/commit/38f264e4573e501dad162d5169365a8907efa2f0))

## [6.0.0](https://www.github.com/googleapis/repo-automation-bots/compare/v5.7.1...v6.0.0) (2020-09-29)


### ⚠ BREAKING CHANGES

* **probot:** upgrade gcf-utils to probot@10, @octokit/rest@18 (#963)

### Code Refactoring

* **probot:** upgrade gcf-utils to probot@10, @octokit/rest@18 ([#963](https://www.github.com/googleapis/repo-automation-bots/issues/963)) ([a601f4a](https://www.github.com/googleapis/repo-automation-bots/commit/a601f4acb415d80258021549104124cef1a447d1))

### [5.7.1](https://www.github.com/googleapis/repo-automation-bots/compare/v5.7.0...v5.7.1) (2020-09-14)


### Bug Fixes

* **deps:** update dependency yargs to v16 ([#944](https://www.github.com/googleapis/repo-automation-bots/issues/944)) ([1579ab6](https://www.github.com/googleapis/repo-automation-bots/commit/1579ab6694dcbf174aa2d936d5a68d31d6ac5bab))

## [5.7.0](https://www.github.com/googleapis/repo-automation-bots/compare/v5.6.0...v5.7.0) (2020-09-02)


### Features

* bind trigger information to all logs ([#926](https://www.github.com/googleapis/repo-automation-bots/issues/926)) ([dcdd281](https://www.github.com/googleapis/repo-automation-bots/commit/dcdd281b06524203788946470fbb8012179d2c98))

## [5.6.0](https://www.github.com/googleapis/repo-automation-bots/compare/v5.5.1...v5.6.0) (2020-08-28)


### Features

* **gcf-utils:** log event type with trigger information ([#921](https://www.github.com/googleapis/repo-automation-bots/issues/921)) ([023ed12](https://www.github.com/googleapis/repo-automation-bots/commit/023ed126aa478ab80279a27f8a194a88e5aff44d))

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

## [0.4.1](https://github.com/googleapis/repo-automation-bots/) (2019-07-30)


### Bug Fixes

* **docs:** add appropriate meta information ([#11](https://github.com/googleapis/repo-automation-bots/issues/11)) ([a9c0590](https://github.com/googleapis/repo-automation-bots/commit/a9c0590))





# 0.4.0 (2019-07-30)


### Bug Fixes

* **deps:** update dependency @google-cloud/storage to v3 ([#9](https://github.com/googleapis/repo-automation-bots/issues/9)) ([1c98b01](https://github.com/googleapis/repo-automation-bots/commit/1c98b01))
* **lint:** get linting working ([#8](https://github.com/googleapis/repo-automation-bots/issues/8)) ([70a6bcd](https://github.com/googleapis/repo-automation-bots/commit/70a6bcd))
* don't use absolute path for gts config ([#3](https://github.com/googleapis/repo-automation-bots/issues/3)) ([6deba89](https://github.com/googleapis/repo-automation-bots/commit/6deba89))


### Features

* **infra:** Created bootstrapping infra for GCF ([5ec6d24](https://github.com/googleapis/repo-automation-bots/commit/5ec6d24))
* added utils for running probot apps in gcf ([#2](https://github.com/googleapis/repo-automation-bots/issues/2)) ([0032e84](https://github.com/googleapis/repo-automation-bots/commit/0032e84))





# 0.3.0 (2019-07-30)


### Bug Fixes

* **deps:** update dependency @google-cloud/storage to v3 ([#9](https://github.com/googleapis/repo-automation-bots/issues/9)) ([1c98b01](https://github.com/googleapis/repo-automation-bots/commit/1c98b01))
* **lint:** get linting working ([#8](https://github.com/googleapis/repo-automation-bots/issues/8)) ([70a6bcd](https://github.com/googleapis/repo-automation-bots/commit/70a6bcd))
* don't use absolute path for gts config ([#3](https://github.com/googleapis/repo-automation-bots/issues/3)) ([6deba89](https://github.com/googleapis/repo-automation-bots/commit/6deba89))


### Features

* **infra:** Created bootstrapping infra for GCF ([5ec6d24](https://github.com/googleapis/repo-automation-bots/commit/5ec6d24))
* added utils for running probot apps in gcf ([#2](https://github.com/googleapis/repo-automation-bots/issues/2)) ([0032e84](https://github.com/googleapis/repo-automation-bots/commit/0032e84))





# 0.2.0 (2019-07-30)


### Bug Fixes

* **deps:** update dependency @google-cloud/storage to v3 ([#9](https://github.com/googleapis/repo-automation-bots/issues/9)) ([1c98b01](https://github.com/googleapis/repo-automation-bots/commit/1c98b01))
* **lint:** get linting working ([#8](https://github.com/googleapis/repo-automation-bots/issues/8)) ([70a6bcd](https://github.com/googleapis/repo-automation-bots/commit/70a6bcd))
* don't use absolute path for gts config ([#3](https://github.com/googleapis/repo-automation-bots/issues/3)) ([6deba89](https://github.com/googleapis/repo-automation-bots/commit/6deba89))


### Features

* **infra:** Created bootstrapping infra for GCF ([5ec6d24](https://github.com/googleapis/repo-automation-bots/commit/5ec6d24))
* added utils for running probot apps in gcf ([#2](https://github.com/googleapis/repo-automation-bots/issues/2)) ([0032e84](https://github.com/googleapis/repo-automation-bots/commit/0032e84))
