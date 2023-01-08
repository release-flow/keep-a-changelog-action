# Keep a Changelog Action

A GitHub Action that performs various operations on changelogs that adhere to
[keep-a-changelog](https://keepachangelog.com/en/1.0.0/) and [Semantic Versioning](https://semver.org/) conventions.

## Commands

### [bump](./docs/bump.md)

Updates a changelog by converting the '[Unreleased]' section to the latest release number. The release number is
automatically incremented according to the action parameters.

### [query](./docs/query.md)

Queries release information for a specified version from a changelog.

## Updating from V1 to V2

The upgrade is fairly straightforward, documented [here](./docs/upgrade-v2.md).

## License

The scripts and documentation in this project are released under the [MIT License](./LICENSE).
