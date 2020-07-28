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





## [6.0.0](https://www.github.com/googleapis/repo-automation-bots/compare/v5.3.0...v6.0.0) (2020-07-28)


### ⚠ BREAKING CHANGES

* **gcf-utils,label-sync:** use /installation/repositories to get repo list (#645)
* **gcf-utils:** Use Secret Manager as opposed to KMS + GCS  (#506)
* **gcf-utils:** Use Secret Manager as opposed to KMS + GCS (#480)
* **deps:** upgrade to newest version of probot (#140)

### Features

* add bot for npm publication through wombat ([#184](https://www.github.com/googleapis/repo-automation-bots/issues/184)) ([851e77d](https://www.github.com/googleapis/repo-automation-bots/commit/851e77daf464344a89f0774b9e43142026d6bd8d))
* **gcf-utils:** add Cloud Tasks retry logic ([#442](https://www.github.com/googleapis/repo-automation-bots/issues/442)) ([9811933](https://www.github.com/googleapis/repo-automation-bots/commit/9811933905f45e6fbdab40d878980458040fc0cf))
* added utils for running probot apps in gcf ([#2](https://www.github.com/googleapis/repo-automation-bots/issues/2)) ([0032e84](https://www.github.com/googleapis/repo-automation-bots/commit/0032e84f5046de72a17eb76df095744683073b75))
* **gcf-util:** add a plugin for Octokit to automatically log bot actions ([#686](https://www.github.com/googleapis/repo-automation-bots/issues/686)) ([e381a7d](https://www.github.com/googleapis/repo-automation-bots/commit/e381a7dbc4e2bdb3b3a3dae46d312cf2ed150385))
* **gcf-utils:** export an interface for CronPayload ([#644](https://www.github.com/googleapis/repo-automation-bots/issues/644)) ([4fbdfc5](https://www.github.com/googleapis/repo-automation-bots/commit/4fbdfc5d9837b5c2b2f498f940b761ce80db8f38))
* **gcf-utils:** Log bot execution trigger information from gcf-utils ([#670](https://www.github.com/googleapis/repo-automation-bots/issues/670)) ([be35fd8](https://www.github.com/googleapis/repo-automation-bots/commit/be35fd847f398e1e435239d164b8b8288c309570))
* **gcf-utils:** provide a standardized logger for repo automation bots ([#654](https://www.github.com/googleapis/repo-automation-bots/issues/654)) ([5f8220a](https://www.github.com/googleapis/repo-automation-bots/commit/5f8220a58c0bb3c12f807bc363f20be6e2fb8b71))
* merge-on-green bot ([#287](https://www.github.com/googleapis/repo-automation-bots/issues/287)) ([338cce8](https://www.github.com/googleapis/repo-automation-bots/commit/338cce876f808316ddf2d0caca6cc23710bd38df))
* **gcf-utils:** some bots have large payloads not appropriate for cloud task payload  ([#700](https://www.github.com/googleapis/repo-automation-bots/issues/700)) ([37ca0d3](https://www.github.com/googleapis/repo-automation-bots/commit/37ca0d3c4c5a8c3cc71a309cd061f40ace47e47a))
* make gcf-utils work with pubsub ([#196](https://www.github.com/googleapis/repo-automation-bots/issues/196)) ([5c989b1](https://www.github.com/googleapis/repo-automation-bots/commit/5c989b113a18abe57c19654a80076d91f631eca6))
* **gcf-utils:** Use Secret Manager as opposed to KMS + GCS  ([#506](https://www.github.com/googleapis/repo-automation-bots/issues/506)) ([a1e6519](https://www.github.com/googleapis/repo-automation-bots/commit/a1e65190e74695d75e3d7f023e8101daee50a6e9)), closes [#480](https://www.github.com/googleapis/repo-automation-bots/issues/480) [#502](https://www.github.com/googleapis/repo-automation-bots/issues/502)
* **gcf-utils:** Use Secret Manager as opposed to KMS + GCS ([#480](https://www.github.com/googleapis/repo-automation-bots/issues/480)) ([92d0353](https://www.github.com/googleapis/repo-automation-bots/commit/92d0353ca93186d475d745e67ba4e47174eadda5))
* **gcf-utils:** utility to add/upload probot secrets. ([#18](https://www.github.com/googleapis/repo-automation-bots/issues/18)) ([d3ddaf2](https://www.github.com/googleapis/repo-automation-bots/commit/d3ddaf268a2a4e9ca7676d71dcabec6b7dcf4229))
* **gcf-utils,label-sync:** use /installation/repositories to get repo list ([#645](https://www.github.com/googleapis/repo-automation-bots/issues/645)) ([e006a4d](https://www.github.com/googleapis/repo-automation-bots/commit/e006a4d98b9ba44a6088077e0ae22c7981a1ba3b))
* improvements to cron functionality ([#167](https://www.github.com/googleapis/repo-automation-bots/issues/167)) ([f7b2d22](https://www.github.com/googleapis/repo-automation-bots/commit/f7b2d22fa64b7ff9ccd6536d15fedc84147642b6))
* **GCFLogger:** support Cloud Logging/Stackdriver severity levels ([#746](https://www.github.com/googleapis/repo-automation-bots/issues/746)) ([adfb012](https://www.github.com/googleapis/repo-automation-bots/commit/adfb012c6cdb01a698a73fd6acd90501046fe5ca))
* adds package-lock.json to make upgrades more explicit ([#130](https://www.github.com/googleapis/repo-automation-bots/issues/130)) ([4be4413](https://www.github.com/googleapis/repo-automation-bots/commit/4be44137f69165b58c577d348805493924497273))
* auto-labeling bot ([#247](https://www.github.com/googleapis/repo-automation-bots/issues/247)) ([21cefe0](https://www.github.com/googleapis/repo-automation-bots/commit/21cefe0a560b38be66a4cdb03a50e2e8c8e4014f))
* lint title if more than 1 commit exists ([#22](https://www.github.com/googleapis/repo-automation-bots/issues/22)) ([51b74fd](https://www.github.com/googleapis/repo-automation-bots/commit/51b74fdf74d384304c16430a903106b2b82cf7f7))
* logger must be turned on with config option ([#733](https://www.github.com/googleapis/repo-automation-bots/issues/733)) ([3b3165c](https://www.github.com/googleapis/repo-automation-bots/commit/3b3165c85b9fb38ee1987b8c7ed05189eb940d3c))
* release gcf-utils with logging ([#693](https://www.github.com/googleapis/repo-automation-bots/issues/693)) ([12db876](https://www.github.com/googleapis/repo-automation-bots/commit/12db8767ce6c839b7b33141e407269e4a012177d))
* scheduled tasks now execute authenticated for each repository ([#166](https://www.github.com/googleapis/repo-automation-bots/issues/166)) ([835ab9a](https://www.github.com/googleapis/repo-automation-bots/commit/835ab9a7c5737a1e66179150e1de5aa28e3d1435))


### Bug Fixes

* address bugs with tasks logic found after deployment ([#469](https://www.github.com/googleapis/repo-automation-bots/issues/469)) ([701ca2d](https://www.github.com/googleapis/repo-automation-bots/commit/701ca2d7aa3115f731c7a1555e5f2f8065a7b5d7))
* allow webhook secret to be specified ([#19](https://www.github.com/googleapis/repo-automation-bots/issues/19)) ([55d00cf](https://www.github.com/googleapis/repo-automation-bots/commit/55d00cf67b632af71620f96ec8685d0efc64b75c))
* credentials should not be base64 encoded when stored ([#164](https://www.github.com/googleapis/repo-automation-bots/issues/164)) ([de31e95](https://www.github.com/googleapis/repo-automation-bots/commit/de31e95e3d135bb3c75fa6d10c09bb98d7bb4ada))
* deploy script had typo/typescript had types issue ([#300](https://www.github.com/googleapis/repo-automation-bots/issues/300)) ([d4b7347](https://www.github.com/googleapis/repo-automation-bots/commit/d4b7347a5517e3bc01b2706bb87e22c5dbe6c8aa))
* don't use absolute path for gts config ([#3](https://www.github.com/googleapis/repo-automation-bots/issues/3)) ([6deba89](https://www.github.com/googleapis/repo-automation-bots/commit/6deba896f1536b13fd8d8c55b7ae12232fa4c93f))
* **deps:** update dependency @google-cloud/storage to v3 ([#9](https://www.github.com/googleapis/repo-automation-bots/issues/9)) ([1c98b01](https://www.github.com/googleapis/repo-automation-bots/commit/1c98b01ae310c236cd059322db7c4a5cbddfaf02))
* **deps:** update dependency @google-cloud/storage to v4 ([#129](https://www.github.com/googleapis/repo-automation-bots/issues/129)) ([1d9893e](https://www.github.com/googleapis/repo-automation-bots/commit/1d9893e9938afe360f550907ba0d44006f9eb19e))
* **deps:** update dependency @google-cloud/storage to v5 ([#545](https://www.github.com/googleapis/repo-automation-bots/issues/545)) ([ced97fd](https://www.github.com/googleapis/repo-automation-bots/commit/ced97fd1999b6fa3be311fceff9cd6b7bb900cc3))
* **deps:** update dependency @google-cloud/tasks to v2 ([#464](https://www.github.com/googleapis/repo-automation-bots/issues/464)) ([01d116d](https://www.github.com/googleapis/repo-automation-bots/commit/01d116dfc084d1a8b1cfd89cd07b41827ed39f7b))
* **deps:** update dependency @octokit/plugin-enterprise-compatibility to v1.2.1 ([#141](https://www.github.com/googleapis/repo-automation-bots/issues/141)) ([684eda0](https://www.github.com/googleapis/repo-automation-bots/commit/684eda073af839099858ccb9c89db43ee70ea579))
* **deps:** update dependency @octokit/plugin-enterprise-compatibility to v1.2.2 ([#412](https://www.github.com/googleapis/repo-automation-bots/issues/412)) ([219b5e6](https://www.github.com/googleapis/repo-automation-bots/commit/219b5e6572f724cf3488f1ddac63bfc3ea876633))
* **deps:** update dependency @octokit/plugin-enterprise-compatibility to v1.2.4 ([#561](https://www.github.com/googleapis/repo-automation-bots/issues/561)) ([472b814](https://www.github.com/googleapis/repo-automation-bots/commit/472b81443990a32f7e3644f2abcf6493f0afb4fc))
* **deps:** update dependency @octokit/plugin-enterprise-compatibility to v1.2.5 ([#589](https://www.github.com/googleapis/repo-automation-bots/issues/589)) ([1434070](https://www.github.com/googleapis/repo-automation-bots/commit/14340703ee06af292045e4e83dcfbbaee6332b24))
* **deps:** update dependency cross-env to v6 ([056fa0b](https://www.github.com/googleapis/repo-automation-bots/commit/056fa0b1316d20d1cfcf57a9fcaef6a22a55fb66))
* **deps:** update dependency gaxios to v3 ([#413](https://www.github.com/googleapis/repo-automation-bots/issues/413)) ([57c8775](https://www.github.com/googleapis/repo-automation-bots/commit/57c877565179708d323df57593deb270dc670ad3))
* **deps:** update dependency probot to v9.9.4 ([#272](https://www.github.com/googleapis/repo-automation-bots/issues/272)) ([6d21e61](https://www.github.com/googleapis/repo-automation-bots/commit/6d21e61c793e63ba92ec5a286314297cf313415d))
* **deps:** update dependency tar to v6 ([#245](https://www.github.com/googleapis/repo-automation-bots/issues/245)) ([c0c4756](https://www.github.com/googleapis/repo-automation-bots/commit/c0c475630c5962490a6061181777183397f87238))
* **deps:** update dependency tmp to ^0.2.0 ([#504](https://www.github.com/googleapis/repo-automation-bots/issues/504)) ([d49a467](https://www.github.com/googleapis/repo-automation-bots/commit/d49a467c3227614d03540a045f96cfcdf25e28a7))
* **deps:** update dependency yargs to v14 ([01e5ed9](https://www.github.com/googleapis/repo-automation-bots/commit/01e5ed98bdac657900ea851fc3cdb7cd6af60ccf))
* **deps:** update dependency yargs to v15 ([#155](https://www.github.com/googleapis/repo-automation-bots/issues/155)) ([ee4e7e1](https://www.github.com/googleapis/repo-automation-bots/commit/ee4e7e18e299346f7f2b6b4c2368083bead92d07))
* update to version of release-please that addresses issue with terraform ([#252](https://www.github.com/googleapis/repo-automation-bots/issues/252)) ([3871ea0](https://www.github.com/googleapis/repo-automation-bots/commit/3871ea08c65afd19e50603053363b9b68d01d2cc))
* **deps:** upgrade to kms v2 ([#462](https://www.github.com/googleapis/repo-automation-bots/issues/462)) ([f90e783](https://www.github.com/googleapis/repo-automation-bots/commit/f90e7834d69fb5fd13598c83dbb0f97bcd21c5e1))
* **docs:** add appropriate meta information ([#11](https://www.github.com/googleapis/repo-automation-bots/issues/11)) ([a9c0590](https://www.github.com/googleapis/repo-automation-bots/commit/a9c059081377aec65fceca28b5b98a79046e698d))
* **gcf-utils:** add missing dev dependency @types/sonic-boom ([#696](https://www.github.com/googleapis/repo-automation-bots/issues/696)) ([d45b16c](https://www.github.com/googleapis/repo-automation-bots/commit/d45b16c72028e12be794e5a5bbd4f45203816abc))
* **gcf-utils:** add repository details to payload for pub/sub triggered executions ([#758](https://www.github.com/googleapis/repo-automation-bots/issues/758)) ([00faedc](https://www.github.com/googleapis/repo-automation-bots/commit/00faedc0a3f5d1e4b39bda6fc5371edb2f921d2b))
* **gcf-utils:** populate repository.owner ([#655](https://www.github.com/googleapis/repo-automation-bots/issues/655)) ([7e3d3d2](https://www.github.com/googleapis/repo-automation-bots/commit/7e3d3d2a46e11661219ff24129cf7325ec66e51b))
* upgrade to same version of probot, fixing typings ([#21](https://www.github.com/googleapis/repo-automation-bots/issues/21)) ([f08869b](https://www.github.com/googleapis/repo-automation-bots/commit/f08869bee14a59b996ff69b8cfab2763bb1e6c68))
* **gcf-utils:** prepackage required type modules and interfaces ([#647](https://www.github.com/googleapis/repo-automation-bots/issues/647)) ([1067542](https://www.github.com/googleapis/repo-automation-bots/commit/1067542267c979a46ad61aa3094a7cda91f2ed5f))
* **lint:** get linting working ([#8](https://www.github.com/googleapis/repo-automation-bots/issues/8)) ([70a6bcd](https://www.github.com/googleapis/repo-automation-bots/commit/70a6bcd179aa55e4a2c077a97dec1c3328a3d9fd))
* **mog:** do not double schedule work ([#719](https://www.github.com/googleapis/repo-automation-bots/issues/719)) ([b1639bc](https://www.github.com/googleapis/repo-automation-bots/commit/b1639bc1f9a5276e4f6d34e1b79c0add7161f6c6))
* drop prepare, which is broken with "npm ci" ([#446](https://www.github.com/googleapis/repo-automation-bots/issues/446)) ([d471fdb](https://www.github.com/googleapis/repo-automation-bots/commit/d471fdb3eaad28f8345f4142e80e613f17b4640e))
* improve documentation on using genkey ([#180](https://www.github.com/googleapis/repo-automation-bots/issues/180)) ([44a7fa3](https://www.github.com/googleapis/repo-automation-bots/commit/44a7fa32d63e97ca44fbace3f61f8663e72f78a1))
* paginate result set when listing installations ([#658](https://www.github.com/googleapis/repo-automation-bots/issues/658)) ([f965e9b](https://www.github.com/googleapis/repo-automation-bots/commit/f965e9bf713f79d49d6bea2c820f9ec9e45ae245))
* probot 9.4.0 broke types for apps written in 9.3.0 ([#72](https://www.github.com/googleapis/repo-automation-bots/issues/72)) ([94999a1](https://www.github.com/googleapis/repo-automation-bots/commit/94999a1cc9e47380b91a301102aff92dc2b5b6ed))
* queue name rules ([#459](https://www.github.com/googleapis/repo-automation-bots/issues/459)) ([b67ff5a](https://www.github.com/googleapis/repo-automation-bots/commit/b67ff5adef148539f2322ab24c76f28971179dd6))
* we were missing an await in gcf-utils ([#350](https://www.github.com/googleapis/repo-automation-bots/issues/350)) ([491cf80](https://www.github.com/googleapis/repo-automation-bots/commit/491cf801f29b03665b7559918eed88f46e8c6af4))


### Reverts

* Revert "feat(gcf-utils)!: Use Secret Manager as opposed to KMS + GCS (#480)" (#502) ([e03ab71](https://www.github.com/googleapis/repo-automation-bots/commit/e03ab7160fb3a9d4d120ef78b3b060d0ba57318f)), closes [#480](https://www.github.com/googleapis/repo-automation-bots/issues/480) [#502](https://www.github.com/googleapis/repo-automation-bots/issues/502)


### Miscellaneous Chores

* **deps:** upgrade to newest version of probot ([#140](https://www.github.com/googleapis/repo-automation-bots/issues/140)) ([23b0731](https://www.github.com/googleapis/repo-automation-bots/commit/23b0731b5578392d7b26bfb76bef1aca3c6f5833))

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
