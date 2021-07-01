# Changelog

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
