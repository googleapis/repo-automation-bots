# Changelog

## [4.1.0](https://github.com/googleapis/repo-automation-bots/compare/datastore-lock-v4.0.4...datastore-lock-v4.1.0) (2023-05-17)


### Features

* add `withDatastoreLock()` helper ([#5057](https://github.com/googleapis/repo-automation-bots/issues/5057)) ([ec2c8e3](https://github.com/googleapis/repo-automation-bots/commit/ec2c8e3b2c87223835a5d3a4b4b7ce6fc7fe9286))

## [4.0.4](https://github.com/googleapis/repo-automation-bots/compare/datastore-lock-v4.0.3...datastore-lock-v4.0.4) (2023-01-10)


### Bug Fixes

* update gcf-utils to update dependency on jsonwebtoken ([#4919](https://github.com/googleapis/repo-automation-bots/issues/4919)) ([b1d4e4b](https://github.com/googleapis/repo-automation-bots/commit/b1d4e4bb9253420cfa8f8ad13f4ec3e9bb9548a3))

## [4.0.3](https://github.com/googleapis/repo-automation-bots/compare/datastore-lock-v4.0.2...datastore-lock-v4.0.3) (2023-01-04)


### Bug Fixes

* upgrade jsonwebtoken to 9.0.0 ([#4820](https://github.com/googleapis/repo-automation-bots/issues/4820)) ([ab1314f](https://github.com/googleapis/repo-automation-bots/commit/ab1314f4b72a86ec90ddf785d7a939ff5877153e))

## [4.0.2](https://github.com/googleapis/repo-automation-bots/compare/datastore-lock-v4.0.1...datastore-lock-v4.0.2) (2022-12-22)


### Bug Fixes

* pin typescript to 4.8.4 for four more bots ([#4806](https://github.com/googleapis/repo-automation-bots/issues/4806)) ([3f4d0b0](https://github.com/googleapis/repo-automation-bots/commit/3f4d0b03c14a80460d4269e174a3613454c7c530))

## [4.0.1](https://github.com/googleapis/repo-automation-bots/compare/datastore-lock-v4.0.0...datastore-lock-v4.0.1) (2022-09-08)


### Bug Fixes

* **deps:** update dependency uuid to v9 ([#4347](https://github.com/googleapis/repo-automation-bots/issues/4347)) ([4144f3c](https://github.com/googleapis/repo-automation-bots/commit/4144f3c347c9ba5de6e16cf67110004dfc1e8cc6))

## [4.0.0](https://github.com/googleapis/repo-automation-bots/compare/datastore-lock-v3.2.1...datastore-lock-v4.0.0) (2022-08-15)


### ⚠ BREAKING CHANGES

* **bot-config-utils:** use gcf-utils 14 (#4143)

### deps

* **bot-config-utils:** use gcf-utils 14 ([#4143](https://github.com/googleapis/repo-automation-bots/issues/4143)) ([2295665](https://github.com/googleapis/repo-automation-bots/commit/22956655ed839268725fa75f1bc11ee856e9e281))

## [3.2.1](https://github.com/googleapis/repo-automation-bots/compare/datastore-lock-v3.2.0...datastore-lock-v3.2.1) (2022-07-01)


### Bug Fixes

* **deps:** update dependency @google-cloud/datastore to v7 ([#4027](https://github.com/googleapis/repo-automation-bots/issues/4027)) ([ae6bb2a](https://github.com/googleapis/repo-automation-bots/commit/ae6bb2acb77dd58a5253a4835c408e0418cdfcc4))

## [3.2.0](https://github.com/googleapis/repo-automation-bots/compare/datastore-lock-v3.1.1...datastore-lock-v3.2.0) (2022-04-14)


### Features

* throw typed error ([#3438](https://github.com/googleapis/repo-automation-bots/issues/3438)) ([8b1ae15](https://github.com/googleapis/repo-automation-bots/commit/8b1ae155a8e09e7c3073591057eee514728982dd))

### [3.1.1](https://github.com/googleapis/repo-automation-bots/compare/datastore-lock-v3.1.0...datastore-lock-v3.1.1) (2022-03-04)


### Bug Fixes

* **datastore-lock:** cache long-running client ([#3255](https://github.com/googleapis/repo-automation-bots/issues/3255)) ([737ad60](https://github.com/googleapis/repo-automation-bots/commit/737ad60e28744ec8fa1e758d803855efed564c8d))

## [3.1.0](https://github.com/googleapis/repo-automation-bots/compare/datastore-lock-v3.0.0...datastore-lock-v3.1.0) (2022-03-03)


### Features

* **datastor-lock:** add peek method ([#3253](https://github.com/googleapis/repo-automation-bots/issues/3253)) ([5bf0ca4](https://github.com/googleapis/repo-automation-bots/commit/5bf0ca42897a8b2f5771a83c928dc3647a02aa31))

## [3.0.0](https://www.github.com/googleapis/repo-automation-bots/compare/datastore-lock-v2.1.0...datastore-lock-v3.0.0) (2021-08-09)


### ⚠ BREAKING CHANGES

* rename organization to google-automations (#1789)
* **datastore-lock:** factoring out datastore-lock (#1764)

### Features

* **datastore-lock:** factoring out datastore-lock ([#1764](https://www.github.com/googleapis/repo-automation-bots/issues/1764)) ([c7072d0](https://www.github.com/googleapis/repo-automation-bots/commit/c7072d02583176a63c4cb9c2e5583bd6f7ab126d))
* upgrade to gcf-utils@12 ([#2262](https://www.github.com/googleapis/repo-automation-bots/issues/2262)) ([bd04376](https://www.github.com/googleapis/repo-automation-bots/commit/bd043767ae59a4eed450f1d18741111dc4c3f8e8))


### Bug Fixes

* **datastore-lock:** use hashed value for datastore key ([#1944](https://www.github.com/googleapis/repo-automation-bots/issues/1944)) ([7138ccc](https://www.github.com/googleapis/repo-automation-bots/commit/7138ccce5fe93e76cb8519fb4faad8e75d85f99d))
* rename organization to google-automations ([#1789](https://www.github.com/googleapis/repo-automation-bots/issues/1789)) ([1b8540a](https://www.github.com/googleapis/repo-automation-bots/commit/1b8540a6733ca75efe9e6cea415daa4a627add47))
* update libraries to gcf-utils 11 ([#2117](https://www.github.com/googleapis/repo-automation-bots/issues/2117)) ([5afebc3](https://www.github.com/googleapis/repo-automation-bots/commit/5afebc3781cd511a5fc6cd4485c2b002fcacacb4))

## [2.1.0](https://www.github.com/googleapis/repo-automation-bots/compare/datastore-lock-v2.0.2...datastore-lock-v2.1.0) (2021-07-13)


### Features

* upgrade to gcf-utils@12 ([#2262](https://www.github.com/googleapis/repo-automation-bots/issues/2262)) ([bd04376](https://www.github.com/googleapis/repo-automation-bots/commit/bd043767ae59a4eed450f1d18741111dc4c3f8e8))

### [2.0.2](https://www.github.com/googleapis/repo-automation-bots/compare/datastore-lock-v2.0.1...datastore-lock-v2.0.2) (2021-06-18)


### Bug Fixes

* update libraries to gcf-utils 11 ([#2117](https://www.github.com/googleapis/repo-automation-bots/issues/2117)) ([5afebc3](https://www.github.com/googleapis/repo-automation-bots/commit/5afebc3781cd511a5fc6cd4485c2b002fcacacb4))

### [2.0.1](https://www.github.com/googleapis/repo-automation-bots/compare/datastore-lock-v2.0.0...datastore-lock-v2.0.1) (2021-06-06)


### Bug Fixes

* **datastore-lock:** use hashed value for datastore key ([#1944](https://www.github.com/googleapis/repo-automation-bots/issues/1944)) ([7138ccc](https://www.github.com/googleapis/repo-automation-bots/commit/7138ccce5fe93e76cb8519fb4faad8e75d85f99d))

## [2.0.0](https://www.github.com/googleapis/repo-automation-bots/compare/datastore-lock-v1.0.0...datastore-lock-v2.0.0) (2021-05-18)


### ⚠ BREAKING CHANGES

* rename organization to google-automations (#1789)

### Bug Fixes

* rename organization to google-automations ([#1789](https://www.github.com/googleapis/repo-automation-bots/issues/1789)) ([1b8540a](https://www.github.com/googleapis/repo-automation-bots/commit/1b8540a6733ca75efe9e6cea415daa4a627add47))

## [1.0.0](https://www.github.com/googleapis/repo-automation-bots/compare/datastore-lock-v0.1.0...datastore-lock-v1.0.0) (2021-05-13)


### ⚠ BREAKING CHANGES

* **datastore-lock:** factoring out datastore-lock (#1764)

### Features

* **datastore-lock:** factoring out datastore-lock ([#1764](https://www.github.com/googleapis/repo-automation-bots/issues/1764)) ([c7072d0](https://www.github.com/googleapis/repo-automation-bots/commit/c7072d02583176a63c4cb9c2e5583bd6f7ab126d))
