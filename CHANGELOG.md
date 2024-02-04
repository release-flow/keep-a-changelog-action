# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [3.0.0] - 2024-02-04

### Changed

- **BREAKING**: Update runtime to use Node 20. The action now requires a minimum version of v2.308.0 for the Actions runner.
  Update self-hosted runners to v2.308.0 or later to ensure compatibility.

- Update all workflows to latest version of GH actions.

## [2.2.1] - 2023-03-11

### Changed

- Update all outdated npm dependencies (mainly those `unist` deps flagged by Snyk).

## [2.2.0] - 2023-01-18

### Added

- Add the `fail-on-empty-release-notes` input to enable reporting an error if there are no release notes in the
  `[Unreleased]` section.

## [2.1.0] - 2023-01-15

### Added

- Add support for optionally keeping an 'Unreleased' section in the output changelog after bumping.

- Add GitHub Action branding

## [2.0.0] - 2023-01-08

### Added

- Added documentation on upgrading to V2

### Changed

- Combine all actions into a single action. ***Breaking***

## [1.4.1] - 2022-11-28

### Changed

- Get the automated checks to run on an autorelease PR (see
  [here](https://github.com/release-flow/keep-a-changelog-action/pull/31)).

## [1.4.0] - 2022-11-28

### Changed

- The `get-release-info` action supports a new option for the `release-version` input: `latest-or-unreleased`. This
  option provides support for changelogs that only have an `[Unreleased]` section.

## [1.3.0] - 2022-11-21

### Added

- Handle the changes to GitHub output variables caused by the deprecation of the
  [set-output](https://github.blog/changelog/2022-10-11-github-actions-deprecating-save-state-and-set-output-commands/)
  workflow command. This implemented in a backwardly-compatible way so that it continues to work with downlevel (e.g.
  self-hosted) agents although it has not been tested on any.

## [1.2.0] - 2022-11-20

### Added

- Add `get-release-info` action.

### Deprecated

- Deprecate `get-release-notes` action.

## [1.1.0] - 2022-03-25

### Added

- Automatically move the major version tag when a release is published

- Add `check_dist` workflow to ensure the `dist/` directory is up-to-date

### Fixed

- Correct some of the examples in the README

## [1.0.0] - 2022-03-14

### Added

- Release preparation for v1

## [0.1.0] - 2022-03-14

### Added

- Initial content including change log

[3.0.0]: https://github.com/release-flow/keep-a-changelog-action/compare/v2.2.1...v3.0.0

[2.2.1]: https://github.com/release-flow/keep-a-changelog-action/compare/v2.2.0...v2.2.1

[2.2.0]: https://github.com/release-flow/keep-a-changelog-action/compare/v2.1.0...v2.2.0

[2.1.0]: https://github.com/release-flow/keep-a-changelog-action/compare/v2.0.0...v2.1.0

[2.0.0]: https://github.com/release-flow/keep-a-changelog-action/compare/v1.4.1...v2.0.0

[1.4.1]: https://github.com/release-flow/keep-a-changelog-action/compare/v1.4.0...v1.4.1

[1.4.0]: https://github.com/release-flow/keep-a-changelog-action/compare/v1.3.0...v1.4.0

[1.3.0]: https://github.com/release-flow/keep-a-changelog-action/compare/v1.2.0...v1.3.0

[1.2.0]: https://github.com/release-flow/keep-a-changelog-action/compare/v1.1.0...v1.2.0

[1.1.0]: https://github.com/release-flow/keep-a-changelog-action/compare/v1.0.0...v1.1.0

[1.0.0]: https://github.com/release-flow/keep-a-changelog-action/compare/v0.1.0...v1.0.0

[0.1.0]: https://github.com/release-flow/keep-a-changelog-action/releases/tag/v0.1.0
