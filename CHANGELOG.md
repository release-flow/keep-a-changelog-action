# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased]

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

[1.2.0]: https://github.com/release-flow/keep-a-changelog-action/compare/v1.1.0...v1.2.0

[1.1.0]: https://github.com/release-flow/keep-a-changelog-action/compare/v1.0.0...v1.1.0

[1.0.0]: https://github.com/release-flow/keep-a-changelog-action/compare/v0.1.0...v1.0.0

[0.1.0]: https://github.com/release-flow/keep-a-changelog-action/releases/tag/v0.1.0
