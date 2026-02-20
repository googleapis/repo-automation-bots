# Changelog

## [1.7.1](https://github.com/googleapis/repo-automation-bots/compare/mono-repo-publish-v1.7.0...mono-repo-publish-v1.7.1) (2026-02-20)


### Bug Fixes

* security vulnerability with js-yaml ([#5965](https://github.com/googleapis/repo-automation-bots/issues/5965)) ([fad9d6c](https://github.com/googleapis/repo-automation-bots/commit/fad9d6c60fa5f82b19dd18e3608b7d771e595a9e))

## [1.7.0](https://github.com/googleapis/repo-automation-bots/compare/mono-repo-publish-v1.6.4...mono-repo-publish-v1.7.0) (2023-03-28)


### Features

* update mono-repo-publish to leave a tarball for archiving ([#5015](https://github.com/googleapis/repo-automation-bots/issues/5015)) ([07e6b56](https://github.com/googleapis/repo-automation-bots/commit/07e6b56ae00b50b4ace823fa4f4c63e48570c7b1))

## [1.6.4](https://github.com/googleapis/repo-automation-bots/compare/mono-repo-publish-v1.6.3...mono-repo-publish-v1.6.4) (2023-03-15)


### Bug Fixes

* **logging:** better logging for publication failures ([#4999](https://github.com/googleapis/repo-automation-bots/issues/4999)) ([10ac19e](https://github.com/googleapis/repo-automation-bots/commit/10ac19e46eb17f169ff6b87bf257941dc1dd8910))

## [1.6.3](https://github.com/googleapis/repo-automation-bots/compare/mono-repo-publish-v1.6.2...mono-repo-publish-v1.6.3) (2023-03-14)


### Bug Fixes

* skip publishing private packages ([d982753](https://github.com/googleapis/repo-automation-bots/commit/d982753b2bdc68564e83a0d5dc31165affa8482c))

## [1.6.2](https://github.com/googleapis/repo-automation-bots/compare/mono-repo-publish-v1.6.1...mono-repo-publish-v1.6.2) (2023-01-19)


### Bug Fixes

* **deps:** npm audit fixes for several packages ([#4939](https://github.com/googleapis/repo-automation-bots/issues/4939)) ([a9a6755](https://github.com/googleapis/repo-automation-bots/commit/a9a67552a1cd0278a1b74383c988f099082e949f))

## [1.6.1](https://github.com/googleapis/repo-automation-bots/compare/mono-repo-publish-v1.6.0...mono-repo-publish-v1.6.1) (2023-01-04)


### Bug Fixes

* upgrade jsonwebtoken to 9.0.0 ([#4820](https://github.com/googleapis/repo-automation-bots/issues/4820)) ([ab1314f](https://github.com/googleapis/repo-automation-bots/commit/ab1314f4b72a86ec90ddf785d7a939ff5877153e))

## [1.6.0](https://github.com/googleapis/repo-automation-bots/compare/mono-repo-publish-v1.5.0...mono-repo-publish-v1.6.0) (2022-11-08)


### Features

* allow unauthentiated GitHub API usage ([#4666](https://github.com/googleapis/repo-automation-bots/issues/4666)) ([4dd4b8d](https://github.com/googleapis/repo-automation-bots/commit/4dd4b8d96f255c063c9ae39a5bd3a278db40a86d))

## [1.5.0](https://github.com/googleapis/repo-automation-bots/compare/mono-repo-publish-v1.4.1...mono-repo-publish-v1.5.0) (2022-09-08)


### Features

* add --exclude-files option ([#4368](https://github.com/googleapis/repo-automation-bots/issues/4368)) ([9c9664d](https://github.com/googleapis/repo-automation-bots/commit/9c9664d368661634249cc19819eb40ce09db2dd6))

## [1.4.1](https://github.com/googleapis/repo-automation-bots/compare/mono-repo-publish-v1.3.0...mono-repo-publish-v1.4.1) (2022-08-08)


### Features

* add custom command for running arbitrary publish script ([#4099](https://github.com/googleapis/repo-automation-bots/issues/4099)) ([34b8777](https://github.com/googleapis/repo-automation-bots/commit/34b8777278f3071a0cdf5bfb671b3888263fae64))


### Bug Fixes

* need to compile as part of the prepare step ([0231454](https://github.com/googleapis/repo-automation-bots/commit/0231454de6697eaaf733a01f20fffdcd2f636a2b))

## [1.3.0](https://github.com/googleapis/repo-automation-bots/compare/mono-repo-publish-v1.2.2...mono-repo-publish-v1.3.0) (2022-04-22)


### Features

* **monororepo-publish:** use npm ci/install from registry ([#3480](https://github.com/googleapis/repo-automation-bots/issues/3480)) ([ab2a266](https://github.com/googleapis/repo-automation-bots/commit/ab2a26697620dded7c58cc2fcfbbfc3c220c2c15))

### [1.2.2](https://www.github.com/googleapis/repo-automation-bots/compare/mono-repo-publish-v1.2.1...mono-repo-publish-v1.2.2) (2021-09-15)


### Bug Fixes

* **mono-repo-publish:** root node_modules folder broke typescript compilation ([#2516](https://www.github.com/googleapis/repo-automation-bots/issues/2516)) ([8324600](https://www.github.com/googleapis/repo-automation-bots/commit/8324600bbb527fd6265d1bd8cfe694011f59b046))

### [1.2.1](https://www.github.com/googleapis/repo-automation-bots/compare/mono-repo-publish-v1.2.0...mono-repo-publish-v1.2.1) (2021-09-10)


### Bug Fixes

* **deps:** update mono-repo-publish deps ([#2463](https://www.github.com/googleapis/repo-automation-bots/issues/2463)) ([2321c56](https://www.github.com/googleapis/repo-automation-bots/commit/2321c561d2a17b16aa91bc276ddc530f475324b0))

## [1.2.0](https://www.github.com/googleapis/repo-automation-bots/compare/mono-repo-publish-v1.1.2...mono-repo-publish-v1.2.0) (2021-08-09)


### Features

* **mono-repo-publish:** migrate to repo-automation-bots ([#1593](https://www.github.com/googleapis/repo-automation-bots/issues/1593)) ([debbfda](https://www.github.com/googleapis/repo-automation-bots/commit/debbfda8d897800142fb178c5f2f11b3d7f395a3))


### Bug Fixes

* **deps:** update dependency @octokit/auth-app to v3 ([#1603](https://www.github.com/googleapis/repo-automation-bots/issues/1603)) ([06480d6](https://www.github.com/googleapis/repo-automation-bots/commit/06480d6e7340d3332566d1619dff1a0710a93617))
* **mono-repo-publish:** links should point to repo-automation-bots ([#1597](https://www.github.com/googleapis/repo-automation-bots/issues/1597)) ([90e94a0](https://www.github.com/googleapis/repo-automation-bots/commit/90e94a000e61de4026fff18e40f315ba5f1ef002))

### [1.1.2](https://www.github.com/googleapis/repo-automation-bots/compare/mono-repo-publish-v1.1.1...mono-repo-publish-v1.1.2) (2021-04-06)


### Bug Fixes

* **deps:** update dependency @octokit/auth-app to v3 ([#1603](https://www.github.com/googleapis/repo-automation-bots/issues/1603)) ([06480d6](https://www.github.com/googleapis/repo-automation-bots/commit/06480d6e7340d3332566d1619dff1a0710a93617))

### [1.1.1](https://www.github.com/googleapis/repo-automation-bots/compare/mono-repo-publish-v1.1.0...mono-repo-publish-v1.1.1) (2021-04-01)


### Bug Fixes

* **mono-repo-publish:** links should point to repo-automation-bots ([#1597](https://www.github.com/googleapis/repo-automation-bots/issues/1597)) ([90e94a0](https://www.github.com/googleapis/repo-automation-bots/commit/90e94a000e61de4026fff18e40f315ba5f1ef002))

## [1.1.0](https://www.github.com/googleapis/repo-automation-bots/compare/mono-repo-publish-v1.0.1...mono-repo-publish-v1.1.0) (2021-04-01)


### Features

* **mono-repo-publish:** migrate to repo-automation-bots ([#1593](https://www.github.com/googleapis/repo-automation-bots/issues/1593)) ([debbfda](https://www.github.com/googleapis/repo-automation-bots/commit/debbfda8d897800142fb178c5f2f11b3d7f395a3))

### [1.0.1](https://www.github.com/sofisl/mono-repo-publish/compare/v1.0.0...v1.0.1) (2021-03-23)


### Bug Fixes

* add public flag ([b6bae4d](https://www.github.com/sofisl/mono-repo-publish/commit/b6bae4d3ab29edd14a15675bedc5afb25c55ecdb))
* paginate PR file results ([9e704b3](https://www.github.com/sofisl/mono-repo-publish/commit/9e704b3a2c693bd274ca001ae31ed06220048d67))
* push updates ([12b8da6](https://www.github.com/sofisl/mono-repo-publish/commit/12b8da6ffcedbebd77c28534540129f6c5323a31))

## 1.0.0 (2021-02-25)


### ⚠ BREAKING CHANGES

* breaking change test
* initial release of library

### Features

* add yargs ([5976b53](https://www.github.com/sofisl/mono-repo-publish/commit/5976b53aedd61651f1d22a369523efe8c6183788))
* breaking change test ([d2b30f6](https://www.github.com/sofisl/mono-repo-publish/commit/d2b30f67c0ae329434f6018e48710b9f423af47a))
* initial release of library ([0ab96d7](https://www.github.com/sofisl/mono-repo-publish/commit/0ab96d7b7c627d57cb29edbf479292c8c9c55ef4))
* initial stub of library ([1e2ab9d](https://www.github.com/sofisl/mono-repo-publish/commit/1e2ab9d95a26467e7ebcc9b473b830884ddfd517))
