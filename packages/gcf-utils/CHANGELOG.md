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





## [15.0.0](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v14.4.6...gcf-utils-v15.0.0) (2023-09-12)


### ⚠ BREAKING CHANGES

* require node 18
* remove `addOrUpdateIssueComment` which is moved to issue-utils.

### Features

* remove `addOrUpdateIssueComment` which is moved to issue-utils. ([057125e](https://github.com/googleapis/repo-automation-bots/commit/057125e0fe11d6a6b6b2498e27a1cdb87b404593))
* require node 18 ([057125e](https://github.com/googleapis/repo-automation-bots/commit/057125e0fe11d6a6b6b2498e27a1cdb87b404593))

## [14.4.6](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v14.4.5...gcf-utils-v14.4.6) (2023-01-12)


### Bug Fixes

* update dependency on jsonwebtoken ([#4929](https://github.com/googleapis/repo-automation-bots/issues/4929)) ([325f171](https://github.com/googleapis/repo-automation-bots/commit/325f17191e2c102b53eff6673c0fdd2b10ed642d))

## [14.4.5](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v14.4.4...gcf-utils-v14.4.5) (2023-01-10)


### Bug Fixes

* **deps:** [gcf-utils] update dependency @google-cloud/run to ^0.3.0 ([#4881](https://github.com/googleapis/repo-automation-bots/issues/4881)) ([753b3a3](https://github.com/googleapis/repo-automation-bots/commit/753b3a3e8882b372d8287118521d9171ef7c53dd))

## [14.4.4](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v14.4.3...gcf-utils-v14.4.4) (2023-01-06)


### Bug Fixes

* report errors to error reporting only on the last retry attempt ([#4867](https://github.com/googleapis/repo-automation-bots/issues/4867)) ([d15cb54](https://github.com/googleapis/repo-automation-bots/commit/d15cb540aa7307d2f275a12d6ffecf8ef867d8f7))

## [14.4.3](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v14.4.2...gcf-utils-v14.4.3) (2023-01-04)


### Bug Fixes

* upgrade jsonwebtoken to 9.0.0 ([#4820](https://github.com/googleapis/repo-automation-bots/issues/4820)) ([ab1314f](https://github.com/googleapis/repo-automation-bots/commit/ab1314f4b72a86ec90ddf785d7a939ff5877153e))

## [14.4.2](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v14.4.1...gcf-utils-v14.4.2) (2022-12-22)


### Bug Fixes

* lock the version of typescript to 4.8.4 ([#4800](https://github.com/googleapis/repo-automation-bots/issues/4800)) ([add7f46](https://github.com/googleapis/repo-automation-bots/commit/add7f4637ff6533308b0e5164ab0a4fe9486e3db))

## [14.4.1](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v14.4.0...gcf-utils-v14.4.1) (2022-12-07)


### Bug Fixes

* **deps:** [gcf-utils] update dependency @types/uuid to v9 ([#4759](https://github.com/googleapis/repo-automation-bots/issues/4759)) ([a951ab7](https://github.com/googleapis/repo-automation-bots/commit/a951ab774d0dc9bba1d712987c01f1a73d0d2443))

## [14.4.0](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v14.3.3...gcf-utils-v14.4.0) (2022-12-02)


### Features

* **gcf-utils:** store the payload to gcs only when the body is too big ([#4703](https://github.com/googleapis/repo-automation-bots/issues/4703)) ([9c93052](https://github.com/googleapis/repo-automation-bots/commit/9c93052e3337406eaedd8e2a322d4e8f468fd649))

## [14.3.3](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v14.3.2...gcf-utils-v14.3.3) (2022-11-22)


### Bug Fixes

* logger.child() should preserve original bindings ([#4686](https://github.com/googleapis/repo-automation-bots/issues/4686)) ([9575fa2](https://github.com/googleapis/repo-automation-bots/commit/9575fa2484194f64dcfebe2c09343fcc7a1ea5f5))

## [14.3.2](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v14.3.1...gcf-utils-v14.3.2) (2022-11-21)


### Bug Fixes

* **deps:** use google-gax v3.5.2 ([#4650](https://github.com/googleapis/repo-automation-bots/issues/4650)) ([b01f8a6](https://github.com/googleapis/repo-automation-bots/commit/b01f8a64edd6b11f10bb513c858381469644185f))

## [14.3.1](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v14.3.0...gcf-utils-v14.3.1) (2022-10-31)


### Bug Fixes

* **deps:** [gcf-utils] update dependency @octokit/plugin-enterprise-compatibility to v2.0.3 ([#4568](https://github.com/googleapis/repo-automation-bots/issues/4568)) ([3b0c6bc](https://github.com/googleapis/repo-automation-bots/commit/3b0c6bcff3759d900708d7120f138f7feed488b0))

## [14.3.0](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v14.2.1...gcf-utils-v14.3.0) (2022-09-29)


### Features

* **gcf-utils:** introduce ServiceUnavailable ([#4496](https://github.com/googleapis/repo-automation-bots/issues/4496)) ([3398c8c](https://github.com/googleapis/repo-automation-bots/commit/3398c8c1905da7ac8f65d03cd4eb973c0583efc7))

## [14.2.1](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v14.2.0...gcf-utils-v14.2.1) (2022-09-22)


### Bug Fixes

* **gcf-utils:** cache Cloud Run service URL ([#4487](https://github.com/googleapis/repo-automation-bots/issues/4487)) ([a908803](https://github.com/googleapis/repo-automation-bots/commit/a908803a623c32d029b0d82d2d314b4ce61ff7a7)), closes [#4469](https://github.com/googleapis/repo-automation-bots/issues/4469)

## [14.2.0](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v14.1.1...gcf-utils-v14.2.0) (2022-09-21)


### Features

* **gcf-utils:** Add [@type](https://github.com/type) property for unhandled errors. ([#4438](https://github.com/googleapis/repo-automation-bots/issues/4438)) ([d7b1a70](https://github.com/googleapis/repo-automation-bots/commit/d7b1a70efdd66e77540d99a063a87871d9caa671))

## [14.1.1](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v14.1.0...gcf-utils-v14.1.1) (2022-09-14)


### Bug Fixes

* **deps:** [gcf-utils] update dependency yargs to v17 ([#4375](https://github.com/googleapis/repo-automation-bots/issues/4375)) ([62938db](https://github.com/googleapis/repo-automation-bots/commit/62938dbf505fc65496f5d4a56765559968faa1fc))

## [14.1.0](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v14.0.2...gcf-utils-v14.1.0) (2022-09-12)


### Features

* **gcf-utils:** switch to @google-cloud/run ([#4382](https://github.com/googleapis/repo-automation-bots/issues/4382)) ([54a23ca](https://github.com/googleapis/repo-automation-bots/commit/54a23ca48962d8dc6ddeb5a36876064f5343d557))

## [14.0.2](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v14.0.1...gcf-utils-v14.0.2) (2022-09-08)


### Bug Fixes

* **deps:** update dependency uuid to v9 ([#4347](https://github.com/googleapis/repo-automation-bots/issues/4347)) ([4144f3c](https://github.com/googleapis/repo-automation-bots/commit/4144f3c347c9ba5de6e16cf67110004dfc1e8cc6))

## [14.0.1](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v14.0.0...gcf-utils-v14.0.1) (2022-08-15)


### Bug Fixes

* **deps:** update dependency @octokit/plugin-enterprise-compatibility to v2.0.2 ([#4142](https://github.com/googleapis/repo-automation-bots/issues/4142)) ([0717a6c](https://github.com/googleapis/repo-automation-bots/commit/0717a6cefa4f06e8bb8feda01ce419b56f0f1b08))

## [14.0.0](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v13.8.4...gcf-utils-v14.0.0) (2022-08-12)


### ⚠ BREAKING CHANGES

* **gcf-utils:** update @octokit/rest to 19 (#4132)

### Bug Fixes

* **gcf-utils:** update @octokit/rest to 19 ([#4132](https://github.com/googleapis/repo-automation-bots/issues/4132)) ([a9335e0](https://github.com/googleapis/repo-automation-bots/commit/a9335e00cd72c0eab34f6776c0ec65fe1e68a6eb))

## [13.8.4](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v13.8.3...gcf-utils-v13.8.4) (2022-07-19)


### Bug Fixes

* **deps:** update dependency @octokit/plugin-enterprise-compatibility to v2 ([#4053](https://github.com/googleapis/repo-automation-bots/issues/4053)) ([8a501d4](https://github.com/googleapis/repo-automation-bots/commit/8a501d425f3147609053bfe84e6ec5a0b90b3213))

## [13.8.3](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v13.8.2...gcf-utils-v13.8.3) (2022-07-07)


### Bug Fixes

* handle GraphqlResponseErrors that are rate limit errors ([#4048](https://github.com/googleapis/repo-automation-bots/issues/4048)) ([236d7c6](https://github.com/googleapis/repo-automation-bots/commit/236d7c60f241c70665f82a048cebc00761393761))

## [13.8.2](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v13.8.1...gcf-utils-v13.8.2) (2022-06-22)


### Bug Fixes

* **deps:** update dependency @googleapis/run to v10 ([#3983](https://github.com/googleapis/repo-automation-bots/issues/3983)) ([468e537](https://github.com/googleapis/repo-automation-bots/commit/468e537e838d302465ce1d3de534e3168e1f08b6))

## [13.8.1](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v13.8.0...gcf-utils-v13.8.1) (2022-06-15)


### Bug Fixes

* **deps:** update dependency @google-cloud/kms to v3 ([#3893](https://github.com/googleapis/repo-automation-bots/issues/3893)) ([c63b279](https://github.com/googleapis/repo-automation-bots/commit/c63b279df053abb9e4f814508307674d6a2cfd66))
* **deps:** update dependency @google-cloud/tasks to v3 ([#3895](https://github.com/googleapis/repo-automation-bots/issues/3895)) ([7977ccc](https://github.com/googleapis/repo-automation-bots/commit/7977ccc91d471564cda0fb1ee4f589651756899d))
* **deps:** update dependency @googleapis/run to v9 ([#3939](https://github.com/googleapis/repo-automation-bots/issues/3939)) ([dd6e779](https://github.com/googleapis/repo-automation-bots/commit/dd6e779509fd242a181897bd506ef8d1226c9e5e))
* when logging errors, log all errors contained in an AggregateError ([#3933](https://github.com/googleapis/repo-automation-bots/issues/3933)) ([3266d11](https://github.com/googleapis/repo-automation-bots/commit/3266d1149fd05cdddeecb45d3f75f3cc9896e7ee)), closes [#3819](https://github.com/googleapis/repo-automation-bots/issues/3819)

## [13.8.0](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v13.7.0...gcf-utils-v13.8.0) (2022-06-09)


### Features

* **gcf-utils:** Make the flow control delay configurable ([#3885](https://github.com/googleapis/repo-automation-bots/issues/3885)) ([b4fa541](https://github.com/googleapis/repo-automation-bots/commit/b4fa541904021cf8c45b05e4fb07056424e25c49))

## [13.7.0](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v13.6.0...gcf-utils-v13.7.0) (2022-06-09)


### Features

* **gcf-utils:** add flow control for scheduling jobs ([#3881](https://github.com/googleapis/repo-automation-bots/issues/3881)) ([dfef647](https://github.com/googleapis/repo-automation-bots/commit/dfef64756391269bdc77c104f0ec2dd64a5374f7))


### Bug Fixes

* also handle secondary rate limit errors from GitHub API ([#3879](https://github.com/googleapis/repo-automation-bots/issues/3879)) ([e971f81](https://github.com/googleapis/repo-automation-bots/commit/e971f81de06a5ff0e76f00da2ddf61e72ff7c3ff))

## [13.6.0](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v13.5.4...gcf-utils-v13.6.0) (2022-06-09)


### Features

* log and return 503 on rate limit RequestErrors ([#3812](https://github.com/googleapis/repo-automation-bots/issues/3812)) ([6239c57](https://github.com/googleapis/repo-automation-bots/commit/6239c57b79d950ef57a78134d24ed95d8752ea27))

## [13.5.4](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v13.5.3...gcf-utils-v13.5.4) (2022-06-07)


### Bug Fixes

* **deps:** update dependency pino to v8 ([#3826](https://github.com/googleapis/repo-automation-bots/issues/3826)) ([b9ee6b5](https://github.com/googleapis/repo-automation-bots/commit/b9ee6b5684e9f95e894d89c6b74745e9008983f4))

### [13.5.3](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v13.5.2...gcf-utils-v13.5.3) (2022-05-26)


### Bug Fixes

* **deps:** update dependency @google-cloud/storage to v6 ([#3780](https://github.com/googleapis/repo-automation-bots/issues/3780)) ([cf8c6c3](https://github.com/googleapis/repo-automation-bots/commit/cf8c6c313da853a34559de7235588d65b69e2ef7))

### [13.5.2](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v13.5.1...gcf-utils-v13.5.2) (2022-05-02)


### Bug Fixes

* recalculate request bindings for downloaded payloads ([#3582](https://github.com/googleapis/repo-automation-bots/issues/3582)) ([ae3d35c](https://github.com/googleapis/repo-automation-bots/commit/ae3d35c8b9b875ba7a3b73ac10fbabbabd5adbe2))

### [13.5.1](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v13.5.0...gcf-utils-v13.5.1) (2022-04-29)


### Bug Fixes

* export GCFLogger class ([#3533](https://github.com/googleapis/repo-automation-bots/issues/3533)) ([24b3b00](https://github.com/googleapis/repo-automation-bots/commit/24b3b009e2731c8bb46ab5eddcb9cf160194df54))

## [13.5.0](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v13.4.0...gcf-utils-v13.5.0) (2022-04-28)


### Features

* inject trace logging attribute for request correlation ([#3526](https://github.com/googleapis/repo-automation-bots/issues/3526)) ([6083e2e](https://github.com/googleapis/repo-automation-bots/commit/6083e2e1aa88cd1e501c3632c93a08ee2fda71d2))

## [13.4.0](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v13.3.1...gcf-utils-v13.4.0) (2022-04-27)


### Features

* instantiate new child logger for each request via weakmap cache ([#3516](https://github.com/googleapis/repo-automation-bots/issues/3516)) ([27b07f9](https://github.com/googleapis/repo-automation-bots/commit/27b07f9c6f6e422c055e809c50b27a930d369b68))

### [13.3.1](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v13.3.0...gcf-utils-v13.3.1) (2022-04-21)


### Bug Fixes

* **owl-bot:** allow 30 minutes of execution before retry ([#3472](https://github.com/googleapis/repo-automation-bots/issues/3472)) ([a879b43](https://github.com/googleapis/repo-automation-bots/commit/a879b43becec5b9ce2b94f4b35b255ec6d48f08b)), closes [#3303](https://github.com/googleapis/repo-automation-bots/issues/3303)

## [13.3.0](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v13.2.2...gcf-utils-v13.3.0) (2022-03-31)


### Features

* **gcf-utils:** add an oicd token of the task caller service account ([#3346](https://github.com/googleapis/repo-automation-bots/issues/3346)) ([a9577ba](https://github.com/googleapis/repo-automation-bots/commit/a9577ba63ef1abe4bbb4ad5147c0e1ce9d261324))


### Bug Fixes

* **deps:** update dependency @googleapis/run to v8 ([#3295](https://github.com/googleapis/repo-automation-bots/issues/3295)) ([00c11c3](https://github.com/googleapis/repo-automation-bots/commit/00c11c33b784f6a2bba4197cff8cef1bd7168094))

### [13.2.2](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v13.2.1...gcf-utils-v13.2.2) (2022-03-03)


### Bug Fixes

* **deps:** update dependency @types/lru-cache to v7 ([#3215](https://github.com/googleapis/repo-automation-bots/issues/3215)) ([3c16afb](https://github.com/googleapis/repo-automation-bots/commit/3c16afb297db04457901d1b97d349b16aee7726b))

### [13.2.1](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v13.2.0...gcf-utils-v13.2.1) (2022-02-08)


### Bug Fixes

* **deps:** update dependency @googleapis/run to v6 ([#3144](https://github.com/googleapis/repo-automation-bots/issues/3144)) ([b8c2aaf](https://github.com/googleapis/repo-automation-bots/commit/b8c2aaf89d137b3581448d77dfd68081f58b6ee2))
* **deps:** update dependency @googleapis/run to v7 ([#3161](https://github.com/googleapis/repo-automation-bots/issues/3161)) ([620ec05](https://github.com/googleapis/repo-automation-bots/commit/620ec05b6078f95232fa14438317b24b590671b2))

## [13.2.0](https://github.com/googleapis/repo-automation-bots/compare/gcf-utils-v13.1.0...gcf-utils-v13.2.0) (2022-01-21)


### Features

* allow overriding the backend service name ([#3116](https://github.com/googleapis/repo-automation-bots/issues/3116)) ([4b668fe](https://github.com/googleapis/repo-automation-bots/commit/4b668fedd279e80461a63a6ca1e1c92f35d683e9))

## [13.1.0](https://www.github.com/googleapis/repo-automation-bots/compare/gcf-utils-v13.0.2...gcf-utils-v13.1.0) (2021-11-18)


### Features

* **gcf-utils:** add allowed_organizations to repository cron ([#2909](https://www.github.com/googleapis/repo-automation-bots/issues/2909)) ([4a190c4](https://www.github.com/googleapis/repo-automation-bots/commit/4a190c404e082a7ba2ddd762d1b8debc8b0bebe5))

### [13.0.2](https://www.github.com/googleapis/repo-automation-bots/compare/gcf-utils-v13.0.1...gcf-utils-v13.0.2) (2021-09-17)


### Bug Fixes

* **deps:** update dependency @googleapis/run to v5 ([#2527](https://www.github.com/googleapis/repo-automation-bots/issues/2527)) ([439484f](https://www.github.com/googleapis/repo-automation-bots/commit/439484fbf9fdb2545581472e5e88aa7c5bc8f0d9))

### [13.0.1](https://www.github.com/googleapis/repo-automation-bots/compare/gcf-utils-v13.0.0...gcf-utils-v13.0.1) (2021-08-25)


### Bug Fixes

* stop loggging signature ([#2384](https://www.github.com/googleapis/repo-automation-bots/issues/2384)) ([b6ed87e](https://www.github.com/googleapis/repo-automation-bots/commit/b6ed87e64d6c7599ab463337c3b0990e21ad7a13))

## [13.0.0](https://www.github.com/googleapis/repo-automation-bots/compare/gcf-utils-v12.0.0...gcf-utils-v13.0.0) (2021-08-09)


### ⚠ BREAKING CHANGES

* **gcf-utils:** upgrade to probot 12 (#2253)
* verify payload signatures (#2093)
* **gcf-utils:** add onlyUpdate option to addOrUpdateIssueComment (#2024)
* **gcf-utils:** lock file maintenance (#2001)
* **gcf-utils:** fix getAuthenticatedOctokit (#1826)

### Features

* add helper to build a http.Server instance from a bot function ([#2128](https://www.github.com/googleapis/repo-automation-bots/issues/2128)) ([90430f3](https://www.github.com/googleapis/repo-automation-bots/commit/90430f3024cfd4c502f3001ab90ea585f8b8a85b)), closes [#1817](https://www.github.com/googleapis/repo-automation-bots/issues/1817)
* add max retries config options ([#2116](https://www.github.com/googleapis/repo-automation-bots/issues/2116)) ([4cb9d40](https://www.github.com/googleapis/repo-automation-bots/commit/4cb9d40c715a9a795e54711811e509df85174e60))
* allow configuration of GCFBootstrapper via constructor arguments ([#2150](https://www.github.com/googleapis/repo-automation-bots/issues/2150)) ([534e26b](https://www.github.com/googleapis/repo-automation-bots/commit/534e26bce3efb81556c7ce49bb84f2082deb1121)), closes [#2139](https://www.github.com/googleapis/repo-automation-bots/issues/2139)
* allow queuing Cloud Tasks to hit Cloud Run service ([#2159](https://www.github.com/googleapis/repo-automation-bots/issues/2159)) ([a99805c](https://www.github.com/googleapis/repo-automation-bots/commit/a99805cacd2c534164c90c90072a1ab72fdccc58))
* **cron:** add new schedule.global and schedule.installation cron handlers ([#1868](https://www.github.com/googleapis/repo-automation-bots/issues/1868)) ([42e9ffc](https://www.github.com/googleapis/repo-automation-bots/commit/42e9ffc19ef8f0349b243969a7306129a27b4fa2))
* **gcf-utils:** add onlyUpdate option to addOrUpdateIssueComment ([#2024](https://www.github.com/googleapis/repo-automation-bots/issues/2024)) ([ea93fe2](https://www.github.com/googleapis/repo-automation-bots/commit/ea93fe27d5401e9ca32e08f50914a03a8712a08b))
* **gcf-utils:** extend logger to populate count/event/type ([#1655](https://www.github.com/googleapis/repo-automation-bots/issues/1655)) ([c3f8f11](https://www.github.com/googleapis/repo-automation-bots/commit/c3f8f11d253401a93d9a89d778a39577c50be03a))


### Bug Fixes

* correctly dasherize service name for Cloud Run ([#2216](https://www.github.com/googleapis/repo-automation-bots/issues/2216)) ([9fbf01a](https://www.github.com/googleapis/repo-automation-bots/commit/9fbf01aa59293356bbd8a7e92ec4201de35ec225))
* **deps:** update dependency @octokit/plugin-enterprise-compatibility to v1.2.10 ([#1518](https://www.github.com/googleapis/repo-automation-bots/issues/1518)) ([6e6d40b](https://www.github.com/googleapis/repo-automation-bots/commit/6e6d40b2eed46ee13e9272654a3097f81a83ee8f))
* **deps:** update dependency @octokit/plugin-enterprise-compatibility to v1.2.11 ([#1667](https://www.github.com/googleapis/repo-automation-bots/issues/1667)) ([f2ee62a](https://www.github.com/googleapis/repo-automation-bots/commit/f2ee62ac69397bdbaf69ba2c2136b6d782aa4185))
* **deps:** update dependency @octokit/plugin-enterprise-compatibility to v1.3.0 ([#2043](https://www.github.com/googleapis/repo-automation-bots/issues/2043)) ([a7c91ed](https://www.github.com/googleapis/repo-automation-bots/commit/a7c91ed062922affb2d68a019dea1c82b14a132a))
* detect default task target runtime from environment ([#2233](https://www.github.com/googleapis/repo-automation-bots/issues/2233)) ([7f262e8](https://www.github.com/googleapis/repo-automation-bots/commit/7f262e8f3208a7f5247284fb2880da0e8ebeb359)), closes [#2194](https://www.github.com/googleapis/repo-automation-bots/issues/2194)
* express server should save rawBody ([#2195](https://www.github.com/googleapis/repo-automation-bots/issues/2195)) ([48a6406](https://www.github.com/googleapis/repo-automation-bots/commit/48a64060163d773b4503416ccc7157499206ce22)), closes [#2183](https://www.github.com/googleapis/repo-automation-bots/issues/2183)
* **gcf-utils:** address octokit type regressions ([#1660](https://www.github.com/googleapis/repo-automation-bots/issues/1660)) ([79f7c3f](https://www.github.com/googleapis/repo-automation-bots/commit/79f7c3f0a875b187e170a4bf50f0235d02a02230))
* **gcf-utils:** correctly handle scheduler task for non-background apps ([#2069](https://www.github.com/googleapis/repo-automation-bots/issues/2069)) ([b8bd543](https://www.github.com/googleapis/repo-automation-bots/commit/b8bd543db45f452e0eaef24284e3c9d7f2797b49))
* **gcf-utils:** create tasks in parallel ([#1986](https://www.github.com/googleapis/repo-automation-bots/issues/1986)) ([89d5326](https://www.github.com/googleapis/repo-automation-bots/commit/89d53263653429fb637c02213918b73f1f493a91))
* **gcf-utils:** fix getAuthenticatedOctokit ([#1826](https://www.github.com/googleapis/repo-automation-bots/issues/1826)) ([c602f0f](https://www.github.com/googleapis/repo-automation-bots/commit/c602f0f8de126173c6a0e13fb3b7942cc732df84))
* **gcf-utils:** skip archived repository for scheduler task ([#1853](https://www.github.com/googleapis/repo-automation-bots/issues/1853)) ([706c502](https://www.github.com/googleapis/repo-automation-bots/commit/706c50267690924298a565a46ad62c290bf2f655))
* **gcf-utils:** skip suspended installations ([#2158](https://www.github.com/googleapis/repo-automation-bots/issues/2158)) ([b1b5617](https://www.github.com/googleapis/repo-automation-bots/commit/b1b5617918e2516467977f41e15f05edb872c66e))
* **gcf-utils:** upgrade to probot 12 ([#2253](https://www.github.com/googleapis/repo-automation-bots/issues/2253)) ([57bc7cf](https://www.github.com/googleapis/repo-automation-bots/commit/57bc7cfde2f3d23cb1bd263310b5c131e6c04269))
* **gcf-utils:** use raw body for signature verification ([#2176](https://www.github.com/googleapis/repo-automation-bots/issues/2176)) ([1c68cf1](https://www.github.com/googleapis/repo-automation-bots/commit/1c68cf14e5b7671b6b05d75f419c637456d1bf73)), closes [#2092](https://www.github.com/googleapis/repo-automation-bots/issues/2092)
* only provide the installationId if set ([#2108](https://www.github.com/googleapis/repo-automation-bots/issues/2108)) ([3d8950b](https://www.github.com/googleapis/repo-automation-bots/commit/3d8950b7fa3350200842da18ad8f2ae52f54cecf)), closes [#2107](https://www.github.com/googleapis/repo-automation-bots/issues/2107)
* queue in repository tasks in parallel ([#2121](https://www.github.com/googleapis/repo-automation-bots/issues/2121)) ([e6cb65b](https://www.github.com/googleapis/repo-automation-bots/commit/e6cb65bde901f8f3c04fa2c992e096339ce7d066))
* return a 400 on requests with missing or bad signatures ([#2240](https://www.github.com/googleapis/repo-automation-bots/issues/2240)) ([6cf6964](https://www.github.com/googleapis/repo-automation-bots/commit/6cf696442cd69030d5b5bda7ddce3dee846e5fef))
* skip task queue retries if payload expired ([#2052](https://www.github.com/googleapis/repo-automation-bots/issues/2052)) ([c54f50b](https://www.github.com/googleapis/repo-automation-bots/commit/c54f50b3e1d9c8123d46fef526ef4bb961a547d0)), closes [#2049](https://www.github.com/googleapis/repo-automation-bots/issues/2049)
* typo codespelling grammar ([#2319](https://www.github.com/googleapis/repo-automation-bots/issues/2319)) ([db944e8](https://www.github.com/googleapis/repo-automation-bots/commit/db944e84e008b8a6c7d2ab62b59ee0d5c15e4a40))
* verify payload signatures ([#2093](https://www.github.com/googleapis/repo-automation-bots/issues/2093)) ([a51f489](https://www.github.com/googleapis/repo-automation-bots/commit/a51f489c7d9d6b7bfad53317ac095235158eacbd))


### Miscellaneous Chores

* **gcf-utils:** lock file maintenance ([#2001](https://www.github.com/googleapis/repo-automation-bots/issues/2001)) ([395a87a](https://www.github.com/googleapis/repo-automation-bots/commit/395a87a337ae96c27171beb0ad6b69a798037476))

## [12.0.0](https://www.github.com/googleapis/repo-automation-bots/compare/gcf-utils-v11.4.3...gcf-utils-v12.0.0) (2021-07-09)


### ⚠ BREAKING CHANGES

* **gcf-utils:** upgrade to probot 12 (#2253)

### Bug Fixes

* **gcf-utils:** upgrade to probot 12 ([#2253](https://www.github.com/googleapis/repo-automation-bots/issues/2253)) ([57bc7cf](https://www.github.com/googleapis/repo-automation-bots/commit/57bc7cfde2f3d23cb1bd263310b5c131e6c04269))

### [11.4.3](https://www.github.com/googleapis/repo-automation-bots/compare/gcf-utils-v11.4.2...gcf-utils-v11.4.3) (2021-07-07)


### Bug Fixes

* return a 400 on requests with missing or bad signatures ([#2240](https://www.github.com/googleapis/repo-automation-bots/issues/2240)) ([6cf6964](https://www.github.com/googleapis/repo-automation-bots/commit/6cf696442cd69030d5b5bda7ddce3dee846e5fef))

### [11.4.2](https://www.github.com/googleapis/repo-automation-bots/compare/gcf-utils-v11.4.1...gcf-utils-v11.4.2) (2021-07-02)


### Bug Fixes

* detect default task target runtime from environment ([#2233](https://www.github.com/googleapis/repo-automation-bots/issues/2233)) ([7f262e8](https://www.github.com/googleapis/repo-automation-bots/commit/7f262e8f3208a7f5247284fb2880da0e8ebeb359)), closes [#2194](https://www.github.com/googleapis/repo-automation-bots/issues/2194)

### [11.4.1](https://www.github.com/googleapis/repo-automation-bots/compare/gcf-utils-v11.4.0...gcf-utils-v11.4.1) (2021-06-30)


### Bug Fixes

* correctly dasherize service name for Cloud Run ([#2216](https://www.github.com/googleapis/repo-automation-bots/issues/2216)) ([9fbf01a](https://www.github.com/googleapis/repo-automation-bots/commit/9fbf01aa59293356bbd8a7e92ec4201de35ec225))

## [11.4.0](https://www.github.com/googleapis/repo-automation-bots/compare/gcf-utils-v11.3.1...gcf-utils-v11.4.0) (2021-06-28)


### Features

* allow queuing Cloud Tasks to hit Cloud Run service ([#2159](https://www.github.com/googleapis/repo-automation-bots/issues/2159)) ([a99805c](https://www.github.com/googleapis/repo-automation-bots/commit/a99805cacd2c534164c90c90072a1ab72fdccc58))


### Bug Fixes

* express server should save rawBody ([#2195](https://www.github.com/googleapis/repo-automation-bots/issues/2195)) ([48a6406](https://www.github.com/googleapis/repo-automation-bots/commit/48a64060163d773b4503416ccc7157499206ce22)), closes [#2183](https://www.github.com/googleapis/repo-automation-bots/issues/2183)

### [11.3.1](https://www.github.com/googleapis/repo-automation-bots/compare/gcf-utils-v11.3.0...gcf-utils-v11.3.1) (2021-06-25)


### Bug Fixes

* **gcf-utils:** use raw body for signature verification ([#2176](https://www.github.com/googleapis/repo-automation-bots/issues/2176)) ([1c68cf1](https://www.github.com/googleapis/repo-automation-bots/commit/1c68cf14e5b7671b6b05d75f419c637456d1bf73)), closes [#2092](https://www.github.com/googleapis/repo-automation-bots/issues/2092)

## [11.3.0](https://www.github.com/googleapis/repo-automation-bots/compare/gcf-utils-v11.2.0...gcf-utils-v11.3.0) (2021-06-23)


### Features

* allow configuration of GCFBootstrapper via constructor arguments ([#2150](https://www.github.com/googleapis/repo-automation-bots/issues/2150)) ([534e26b](https://www.github.com/googleapis/repo-automation-bots/commit/534e26bce3efb81556c7ce49bb84f2082deb1121)), closes [#2139](https://www.github.com/googleapis/repo-automation-bots/issues/2139)


### Bug Fixes

* **gcf-utils:** skip suspended installations ([#2158](https://www.github.com/googleapis/repo-automation-bots/issues/2158)) ([b1b5617](https://www.github.com/googleapis/repo-automation-bots/commit/b1b5617918e2516467977f41e15f05edb872c66e))

## [11.2.0](https://www.github.com/googleapis/repo-automation-bots/compare/gcf-utils-v11.1.0...gcf-utils-v11.2.0) (2021-06-21)


### Features

* add helper to build a http.Server instance from a bot function ([#2128](https://www.github.com/googleapis/repo-automation-bots/issues/2128)) ([90430f3](https://www.github.com/googleapis/repo-automation-bots/commit/90430f3024cfd4c502f3001ab90ea585f8b8a85b)), closes [#1817](https://www.github.com/googleapis/repo-automation-bots/issues/1817)

## [11.1.0](https://www.github.com/googleapis/repo-automation-bots/compare/gcf-utils-v11.0.2...gcf-utils-v11.1.0) (2021-06-18)


### Features

* add max retries config options ([#2116](https://www.github.com/googleapis/repo-automation-bots/issues/2116)) ([4cb9d40](https://www.github.com/googleapis/repo-automation-bots/commit/4cb9d40c715a9a795e54711811e509df85174e60))

### [11.0.2](https://www.github.com/googleapis/repo-automation-bots/compare/gcf-utils-v11.0.1...gcf-utils-v11.0.2) (2021-06-18)


### Bug Fixes

* queue in repository tasks in parallel ([#2121](https://www.github.com/googleapis/repo-automation-bots/issues/2121)) ([e6cb65b](https://www.github.com/googleapis/repo-automation-bots/commit/e6cb65bde901f8f3c04fa2c992e096339ce7d066))

### [11.0.1](https://www.github.com/googleapis/repo-automation-bots/compare/gcf-utils-v11.0.0...gcf-utils-v11.0.1) (2021-06-18)


### Bug Fixes

* only provide the installationId if set ([#2108](https://www.github.com/googleapis/repo-automation-bots/issues/2108)) ([3d8950b](https://www.github.com/googleapis/repo-automation-bots/commit/3d8950b7fa3350200842da18ad8f2ae52f54cecf)), closes [#2107](https://www.github.com/googleapis/repo-automation-bots/issues/2107)

## [11.0.0](https://www.github.com/googleapis/repo-automation-bots/compare/gcf-utils-v10.1.0...gcf-utils-v11.0.0) (2021-06-17)


### ⚠ BREAKING CHANGES

* verify payload signatures (#2093)

### Bug Fixes

* verify payload signatures ([#2093](https://www.github.com/googleapis/repo-automation-bots/issues/2093)) ([a51f489](https://www.github.com/googleapis/repo-automation-bots/commit/a51f489c7d9d6b7bfad53317ac095235158eacbd))

## [10.1.0](https://www.github.com/googleapis/repo-automation-bots/compare/gcf-utils-v10.0.2...gcf-utils-v10.1.0) (2021-06-17)


### Features

* **cron:** add new schedule.global and schedule.installation cron handlers ([#1868](https://www.github.com/googleapis/repo-automation-bots/issues/1868)) ([42e9ffc](https://www.github.com/googleapis/repo-automation-bots/commit/42e9ffc19ef8f0349b243969a7306129a27b4fa2))

### [10.0.2](https://www.github.com/googleapis/repo-automation-bots/compare/gcf-utils-v10.0.1...gcf-utils-v10.0.2) (2021-06-16)


### Bug Fixes

* **gcf-utils:** correctly handle scheduler task for non-background apps ([#2069](https://www.github.com/googleapis/repo-automation-bots/issues/2069)) ([b8bd543](https://www.github.com/googleapis/repo-automation-bots/commit/b8bd543db45f452e0eaef24284e3c9d7f2797b49))

### [10.0.1](https://www.github.com/googleapis/repo-automation-bots/compare/gcf-utils-v10.0.0...gcf-utils-v10.0.1) (2021-06-14)


### Bug Fixes

* **deps:** update dependency @octokit/plugin-enterprise-compatibility to v1.3.0 ([#2043](https://www.github.com/googleapis/repo-automation-bots/issues/2043)) ([a7c91ed](https://www.github.com/googleapis/repo-automation-bots/commit/a7c91ed062922affb2d68a019dea1c82b14a132a))
* skip task queue retries if payload expired ([#2052](https://www.github.com/googleapis/repo-automation-bots/issues/2052)) ([c54f50b](https://www.github.com/googleapis/repo-automation-bots/commit/c54f50b3e1d9c8123d46fef526ef4bb961a547d0)), closes [#2049](https://www.github.com/googleapis/repo-automation-bots/issues/2049)

## [10.0.0](https://www.github.com/googleapis/repo-automation-bots/compare/gcf-utils-v9.0.0...gcf-utils-v10.0.0) (2021-06-11)


### ⚠ BREAKING CHANGES

* **gcf-utils:** add onlyUpdate option to addOrUpdateIssueComment (#2024)

### Features

* **gcf-utils:** add onlyUpdate option to addOrUpdateIssueComment ([#2024](https://www.github.com/googleapis/repo-automation-bots/issues/2024)) ([ea93fe2](https://www.github.com/googleapis/repo-automation-bots/commit/ea93fe27d5401e9ca32e08f50914a03a8712a08b))

## [9.0.0](https://www.github.com/googleapis/repo-automation-bots/compare/gcf-utils-v8.0.2...gcf-utils-v9.0.0) (2021-06-09)


### ⚠ BREAKING CHANGES

* **gcf-utils:** lock file maintenance (#2001)

### Miscellaneous Chores

* **gcf-utils:** lock file maintenance ([#2001](https://www.github.com/googleapis/repo-automation-bots/issues/2001)) ([395a87a](https://www.github.com/googleapis/repo-automation-bots/commit/395a87a337ae96c27171beb0ad6b69a798037476))

### [8.0.2](https://www.github.com/googleapis/repo-automation-bots/compare/gcf-utils-v8.0.1...gcf-utils-v8.0.2) (2021-06-09)


### Bug Fixes

* **gcf-utils:** create tasks in parallel ([#1986](https://www.github.com/googleapis/repo-automation-bots/issues/1986)) ([89d5326](https://www.github.com/googleapis/repo-automation-bots/commit/89d53263653429fb637c02213918b73f1f493a91))

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
