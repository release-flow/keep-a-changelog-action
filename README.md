# Keep-a-Changelog Action

A GitHub Action that performs various operations on changelogs that adhere to
[keep-a-changelog](https://keepachangelog.com/en/1.0.0/) and [Semantic Versioning](https://semver.org/) conventions.

## Commands

### [bump](./docs/bump.md)

Updates a changelog by converting the '[Unreleased]' section to the latest release number. The release number is
automatically incremented according to the action parameters.

### [query](./docs/query.md)

Queries release information for a specified version from a changelog.

## Quick start

```yml
    - uses: actions/checkout@v4

    - name: Get the latest release notes
      id: release
      uses: release-flow/keep-a-changelog-action@v3
      with:
        command: query
        version: latest
```

The changelog must follow the [format](./docs/bump.md#changelog-format) described in the `bump` documentation.

## Command line

The commands are also available from the command line, using the `kac` tool in the
[`@release-flow/keep-a-changelog`](https://www.npmjs.com/package/@release-flow/keep-a-changelog) npm package:

```sh
npx @release-flow/keep-a-changelog query --version latest
```

See the [command line documentation](./docs/cli.md) for all options.

## Updating from V1 to V2

The upgrade is fairly straightforward, documented in the [V2 upgrade guide](./docs/upgrade-v2.md).

## License

The scripts and documentation in this project are released under the [MIT License](./LICENSE).
