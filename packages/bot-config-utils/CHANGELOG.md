# Changelog

## [7.0.0](https://github.com/googleapis/repo-automation-bots/compare/bot-config-utils-v6.1.3...bot-config-utils-v7.0.0) (2023-09-18)


### ⚠ BREAKING CHANGES

* require node 18 ([#5225](https://github.com/googleapis/repo-automation-bots/issues/5225))

### Features

* require node 18 ([#5225](https://github.com/googleapis/repo-automation-bots/issues/5225)) ([b2f851a](https://github.com/googleapis/repo-automation-bots/commit/b2f851a741d191719f2e3840b09e4230de9826f9))

## [6.1.3](https://github.com/googleapis/repo-automation-bots/compare/bot-config-utils-v6.1.2...bot-config-utils-v6.1.3) (2023-01-10)


### Bug Fixes

* update gcf-utils to update dependency on jsonwebtoken ([#4919](https://github.com/googleapis/repo-automation-bots/issues/4919)) ([b1d4e4b](https://github.com/googleapis/repo-automation-bots/commit/b1d4e4bb9253420cfa8f8ad13f4ec3e9bb9548a3))

## [6.1.2](https://github.com/googleapis/repo-automation-bots/compare/bot-config-utils-v6.1.1...bot-config-utils-v6.1.2) (2023-01-04)


### Bug Fixes

* upgrade jsonwebtoken to 9.0.0 ([#4820](https://github.com/googleapis/repo-automation-bots/issues/4820)) ([ab1314f](https://github.com/googleapis/repo-automation-bots/commit/ab1314f4b72a86ec90ddf785d7a939ff5877153e))

## [6.1.1](https://github.com/googleapis/repo-automation-bots/compare/bot-config-utils-v6.1.0...bot-config-utils-v6.1.1) (2022-12-22)


### Bug Fixes

* pin typescript to 4.8.4 for four more bots ([#4806](https://github.com/googleapis/repo-automation-bots/issues/4806)) ([3f4d0b0](https://github.com/googleapis/repo-automation-bots/commit/3f4d0b03c14a80460d4269e174a3613454c7c530))

## [6.1.0](https://github.com/googleapis/repo-automation-bots/compare/bot-config-utils-v6.0.0...bot-config-utils-v6.1.0) (2022-08-19)


### Features

* bot-config-utils can validate JSONSchema formats ([#4173](https://github.com/googleapis/repo-automation-bots/issues/4173)) ([024da5c](https://github.com/googleapis/repo-automation-bots/commit/024da5cc4983e7f9dc2dfcedee207ee09f344ab8))

## [6.0.0](https://github.com/googleapis/repo-automation-bots/compare/bot-config-utils-v5.0.0...bot-config-utils-v6.0.0) (2022-08-15)


### ⚠ BREAKING CHANGES

* **bot-config-utils:** use gcf-utils 14 (#4143)

### deps

* **bot-config-utils:** use gcf-utils 14 ([#4143](https://github.com/googleapis/repo-automation-bots/issues/4143)) ([2295665](https://github.com/googleapis/repo-automation-bots/commit/22956655ed839268725fa75f1bc11ee856e9e281))

## [5.0.0](https://github.com/googleapis/repo-automation-bots/compare/bot-config-utils-v4.2.0...bot-config-utils-v5.0.0) (2022-08-08)


### ⚠ BREAKING CHANGES

* **bot-config-utils:** make validateConfigChanges resolve boolean for valid config (#4117)

### Features

* **bot-config-utils:** make validateConfigChanges resolve boolean for valid config ([#4117](https://github.com/googleapis/repo-automation-bots/issues/4117)) ([a9dc853](https://github.com/googleapis/repo-automation-bots/commit/a9dc8534898144167497eb66fa8a8229c6dd890f))

## [4.2.0](https://github.com/googleapis/repo-automation-bots/compare/bot-config-utils-v4.1.0...bot-config-utils-v4.2.0) (2022-08-08)


### Features

* **bot-config-utils:** resolve false on invalid config files ([#4116](https://github.com/googleapis/repo-automation-bots/issues/4116)) ([0c3641c](https://github.com/googleapis/repo-automation-bots/commit/0c3641ce4ff70dd82390be58ab4fe3b6cb51ae44))

## [4.1.0](https://github.com/googleapis/repo-automation-bots/compare/bot-config-utils-v4.0.2...bot-config-utils-v4.1.0) (2022-07-07)


### Features

* add MultiConfigChecker to validate multiple schemas in a single pass ([#4045](https://github.com/googleapis/repo-automation-bots/issues/4045)) ([542b050](https://github.com/googleapis/repo-automation-bots/commit/542b050c0023dfc5248e2a11c633dc600c6ee12b))
* support validating JSON files as well ([542b050](https://github.com/googleapis/repo-automation-bots/commit/542b050c0023dfc5248e2a11c633dc600c6ee12b))

### [4.0.2](https://github.com/googleapis/repo-automation-bots/compare/bot-config-utils-v4.0.1...bot-config-utils-v4.0.2) (2022-05-10)


### Bug Fixes

* throw InvalidConfigurationFormat error on validation error ([#3657](https://github.com/googleapis/repo-automation-bots/issues/3657)) ([8e06d2c](https://github.com/googleapis/repo-automation-bots/commit/8e06d2c6167abc771a2a2ef9e4dbad2bb7a14a36))

### [4.0.1](https://www.github.com/googleapis/repo-automation-bots/compare/bot-config-utils-v4.0.0...bot-config-utils-v4.0.1) (2021-12-02)


### Bug Fixes

* **bot-config-util:** reduce concurrency of file list operation ([#2947](https://www.github.com/googleapis/repo-automation-bots/issues/2947)) ([484e3e0](https://www.github.com/googleapis/repo-automation-bots/commit/484e3e0bfd9ec4d51c5309e01239f731485f976d)), closes [#1949](https://www.github.com/googleapis/repo-automation-bots/issues/1949)

## [4.0.0](https://www.github.com/googleapis/repo-automation-bots/compare/bot-config-utils-v3.2.0...bot-config-utils-v4.0.0) (2021-08-09)


### ⚠ BREAKING CHANGES

* **bot-config-utils:** match the return type of getConfigs (#1802)
* rename organization to google-automations (#1789)
* **bot-config-utils:** factoring out bot-config-utils (#1770)

### Features

* add branch option ([e257b1b](https://www.github.com/googleapis/repo-automation-bots/commit/e257b1b3769ef7e541ad79bc93f1f9cc9ec12b37))
* add schema validation in getConfig and getConfigWithDefault ([e257b1b](https://www.github.com/googleapis/repo-automation-bots/commit/e257b1b3769ef7e541ad79bc93f1f9cc9ec12b37))
* **bot-config-utils:** add getConfigOptions  ([#1890](https://www.github.com/googleapis/repo-automation-bots/issues/1890)) ([e257b1b](https://www.github.com/googleapis/repo-automation-bots/commit/e257b1b3769ef7e541ad79bc93f1f9cc9ec12b37)), closes [#1889](https://www.github.com/googleapis/repo-automation-bots/issues/1889) [#1894](https://www.github.com/googleapis/repo-automation-bots/issues/1894)
* **bot-config-utils:** allow fetching the config from the PR head ([#1793](https://www.github.com/googleapis/repo-automation-bots/issues/1793)) ([ce08ddd](https://www.github.com/googleapis/repo-automation-bots/commit/ce08ddd3186e1498c566bc9de4e8ef995f05b308))
* **bot-config-utils:** factoring out bot-config-utils ([#1770](https://www.github.com/googleapis/repo-automation-bots/issues/1770)) ([b1e4c2d](https://www.github.com/googleapis/repo-automation-bots/commit/b1e4c2df5109a908020bd509970c2c947dd4e6e0))
* skip falling back to `.github` repo ([e257b1b](https://www.github.com/googleapis/repo-automation-bots/commit/e257b1b3769ef7e541ad79bc93f1f9cc9ec12b37))
* support multiple schema files ([e257b1b](https://www.github.com/googleapis/repo-automation-bots/commit/e257b1b3769ef7e541ad79bc93f1f9cc9ec12b37))
* upgrade to gcf-utils@12 ([#2262](https://www.github.com/googleapis/repo-automation-bots/issues/2262)) ([bd04376](https://www.github.com/googleapis/repo-automation-bots/commit/bd043767ae59a4eed450f1d18741111dc4c3f8e8))


### Bug Fixes

* **bot-config-utils:** fix getConfig ([#1785](https://www.github.com/googleapis/repo-automation-bots/issues/1785)) ([fde68cb](https://www.github.com/googleapis/repo-automation-bots/commit/fde68cb9480c5e6abd7b3a1248430255960c2b0d))
* **bot-config-utils:** handle an empty config file ([#1929](https://www.github.com/googleapis/repo-automation-bots/issues/1929)) ([ad084dc](https://www.github.com/googleapis/repo-automation-bots/commit/ad084dccb4d75f74939b5694dcb0d4d2ed7cb0c7)), closes [#1927](https://www.github.com/googleapis/repo-automation-bots/issues/1927)
* **bot-config-utils:** ignore 404 errors ([#1933](https://www.github.com/googleapis/repo-automation-bots/issues/1933)) ([e6b490d](https://www.github.com/googleapis/repo-automation-bots/commit/e6b490d0296bcbc5f0685a9271a2d80163c7ca7a))
* **bot-config-utils:** match the return type of getConfigs ([#1802](https://www.github.com/googleapis/repo-automation-bots/issues/1802)) ([98d5025](https://www.github.com/googleapis/repo-automation-bots/commit/98d5025f5e8f9b8bc5de737793a7f1af366a425f))
* **build:** migrate to using main branch ([#2342](https://www.github.com/googleapis/repo-automation-bots/issues/2342)) ([4319b78](https://www.github.com/googleapis/repo-automation-bots/commit/4319b78b421273e1649d2d799b19fdcbf51adbfd))
* rename organization to google-automations ([#1789](https://www.github.com/googleapis/repo-automation-bots/issues/1789)) ([1b8540a](https://www.github.com/googleapis/repo-automation-bots/commit/1b8540a6733ca75efe9e6cea415daa4a627add47))
* typo codespelling grammar ([#2319](https://www.github.com/googleapis/repo-automation-bots/issues/2319)) ([db944e8](https://www.github.com/googleapis/repo-automation-bots/commit/db944e84e008b8a6c7d2ab62b59ee0d5c15e4a40))
* update libraries to gcf-utils 11 ([#2117](https://www.github.com/googleapis/repo-automation-bots/issues/2117)) ([5afebc3](https://www.github.com/googleapis/repo-automation-bots/commit/5afebc3781cd511a5fc6cd4485c2b002fcacacb4))

## [3.2.0](https://www.github.com/googleapis/repo-automation-bots/compare/bot-config-utils-v3.1.3...bot-config-utils-v3.2.0) (2021-07-13)


### Features

* upgrade to gcf-utils@12 ([#2262](https://www.github.com/googleapis/repo-automation-bots/issues/2262)) ([bd04376](https://www.github.com/googleapis/repo-automation-bots/commit/bd043767ae59a4eed450f1d18741111dc4c3f8e8))

### [3.1.3](https://www.github.com/googleapis/repo-automation-bots/compare/bot-config-utils-v3.1.2...bot-config-utils-v3.1.3) (2021-06-18)


### Bug Fixes

* update libraries to gcf-utils 11 ([#2117](https://www.github.com/googleapis/repo-automation-bots/issues/2117)) ([5afebc3](https://www.github.com/googleapis/repo-automation-bots/commit/5afebc3781cd511a5fc6cd4485c2b002fcacacb4))

### [3.1.2](https://www.github.com/googleapis/repo-automation-bots/compare/bot-config-utils-v3.1.1...bot-config-utils-v3.1.2) (2021-06-09)


### Bug Fixes

* **bot-config-utils:** ignore 404 errors ([#1933](https://www.github.com/googleapis/repo-automation-bots/issues/1933)) ([e6b490d](https://www.github.com/googleapis/repo-automation-bots/commit/e6b490d0296bcbc5f0685a9271a2d80163c7ca7a))

### [3.1.1](https://www.github.com/googleapis/repo-automation-bots/compare/bot-config-utils-v3.1.0...bot-config-utils-v3.1.1) (2021-06-02)


### Bug Fixes

* **bot-config-utils:** handle an empty config file ([#1929](https://www.github.com/googleapis/repo-automation-bots/issues/1929)) ([ad084dc](https://www.github.com/googleapis/repo-automation-bots/commit/ad084dccb4d75f74939b5694dcb0d4d2ed7cb0c7)), closes [#1927](https://www.github.com/googleapis/repo-automation-bots/issues/1927)

## [3.1.0](https://www.github.com/googleapis/repo-automation-bots/compare/bot-config-utils-v3.0.0...bot-config-utils-v3.1.0) (2021-05-28)


### Features

* add branch option ([e257b1b](https://www.github.com/googleapis/repo-automation-bots/commit/e257b1b3769ef7e541ad79bc93f1f9cc9ec12b37))
* add schema validation in getConfig and getConfigWithDefault ([e257b1b](https://www.github.com/googleapis/repo-automation-bots/commit/e257b1b3769ef7e541ad79bc93f1f9cc9ec12b37))
* **bot-config-utils:** add getConfigOptions  ([#1890](https://www.github.com/googleapis/repo-automation-bots/issues/1890)) ([e257b1b](https://www.github.com/googleapis/repo-automation-bots/commit/e257b1b3769ef7e541ad79bc93f1f9cc9ec12b37)), closes [#1889](https://www.github.com/googleapis/repo-automation-bots/issues/1889) [#1894](https://www.github.com/googleapis/repo-automation-bots/issues/1894)
* skip falling back to `.github` repo ([e257b1b](https://www.github.com/googleapis/repo-automation-bots/commit/e257b1b3769ef7e541ad79bc93f1f9cc9ec12b37))
* support multiple schema files ([e257b1b](https://www.github.com/googleapis/repo-automation-bots/commit/e257b1b3769ef7e541ad79bc93f1f9cc9ec12b37))

## [3.0.0](https://www.github.com/googleapis/repo-automation-bots/compare/bot-config-utils-v2.1.0...bot-config-utils-v3.0.0) (2021-05-19)


### ⚠ BREAKING CHANGES

* **bot-config-utils:** match the return type of getConfigs (#1802)

### Bug Fixes

* **bot-config-utils:** match the return type of getConfigs ([#1802](https://www.github.com/googleapis/repo-automation-bots/issues/1802)) ([98d5025](https://www.github.com/googleapis/repo-automation-bots/commit/98d5025f5e8f9b8bc5de737793a7f1af366a425f))

## [2.1.0](https://www.github.com/googleapis/repo-automation-bots/compare/bot-config-utils-v2.0.0...bot-config-utils-v2.1.0) (2021-05-19)


### Features

* **bot-config-utils:** allow fetching the config from the PR head ([#1793](https://www.github.com/googleapis/repo-automation-bots/issues/1793)) ([ce08ddd](https://www.github.com/googleapis/repo-automation-bots/commit/ce08ddd3186e1498c566bc9de4e8ef995f05b308))

## [2.0.0](https://www.github.com/googleapis/repo-automation-bots/compare/bot-config-utils-v1.0.0...bot-config-utils-v2.0.0) (2021-05-18)


### ⚠ BREAKING CHANGES

* rename organization to google-automations (#1789)

### Bug Fixes

* **bot-config-utils:** fix getConfig ([#1785](https://www.github.com/googleapis/repo-automation-bots/issues/1785)) ([fde68cb](https://www.github.com/googleapis/repo-automation-bots/commit/fde68cb9480c5e6abd7b3a1248430255960c2b0d))
* rename organization to google-automations ([#1789](https://www.github.com/googleapis/repo-automation-bots/issues/1789)) ([1b8540a](https://www.github.com/googleapis/repo-automation-bots/commit/1b8540a6733ca75efe9e6cea415daa4a627add47))

## [1.0.0](https://www.github.com/googleapis/repo-automation-bots/compare/bot-config-utils-v0.1.0...bot-config-utils-v1.0.0) (2021-05-17)


### ⚠ BREAKING CHANGES

* **bot-config-utils:** factoring out bot-config-utils (#1770)

### Features

* **bot-config-utils:** factoring out bot-config-utils ([#1770](https://www.github.com/googleapis/repo-automation-bots/issues/1770)) ([b1e4c2d](https://www.github.com/googleapis/repo-automation-bots/commit/b1e4c2df5109a908020bd509970c2c947dd4e6e0))
