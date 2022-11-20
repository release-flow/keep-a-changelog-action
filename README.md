# Keep a Changelog Actions

A set of GitHub Actions that operate on changelogs that adhere to
[keep-a-changelog](https://keepachangelog.com/en/1.0.0/) and [Semantic Versioning](https://semver.org/) conventions.

## Actions

### [prepare-release](./docs/prepare-release.md)

Updates a changelog by converting the 'Unreleased' section to the latest release number. The release number is
automatically incremented according to the action parameters.

### [get-release-info](./docs/get-release-info.md)

Extracts the release information for a specified version from a changelog.

### [get-release-notes](./docs/get-release-notes.md)

:heavy_exclamation_mark: This action is deprecated, and will be removed in a future version.

Extracts the release notes markdown for a specified version from a changelog.

## License

The scripts and documentation in this project are released under the [MIT License](./LICENSE).
