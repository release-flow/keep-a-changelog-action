# Keep a Changelog Action: Bump Command

The `bump` command updates a changelog by converting the `[Unreleased]` section to the latest release number. The release
number is automatically incremented according to the action parameters. The command operates as follows:

- Validates that the changelog adheres to the [conventions](#changelog-format).

- Determines the current release number based on the release history in the changelog.

- Calculates the next release number by incrementing the current release number based on input parameters.

- Converts the `[Unreleased]` section of the changelog to the next release number.

- Re-generates the link definitions at the end of the changelog.

The command is also available from the [command line](./cli.md#kac-bump).

## Usage

```yml
    - uses: actions/checkout@v4

    - name: Bump changelog version
      uses: release-flow/keep-a-changelog-action@v3
      with:
        command: bump
        version: patch
```

## Action inputs

| Name | Description | Default |
| --- | --- | --- |
| `command` | Must contain the value `bump`. The action fails if it is missing or is not `bump` or `query`. | n/a |
| `version` | Specifies how the release number is incremented. See [below](#the-version-input). | **Required parameter** |
| `preid` | The "prerelease identifier" to use as a prefix for the "prerelease" part of a semver. For example, it would specify the 'beta' in '1.0.0-beta.1'. Only used by the `premajor`, `preminor`, `prepatch` and `prerelease` release types. | Empty string |
| `release-date` | The release date that is written into the changelog for the new release, in ISO 8601 format, e.g. `2022-03-03`. The action fails if the value is not a valid date. | Current date |
| `tag-prefix` | The prefix that is applied to the release number to generate the release tag. It is used when generating the link definitions at the end of the changelog. | `v` |
| `changelog` | The path to the changelog to modify. If a relative path is specified, it is appended to the GitHub workspace path. | `CHANGELOG.md` |
| `output-file` | The name of the modified changelog file, which is written relative to the directory of the input changelog. If not specified, the input changelog is overwritten. | Empty string |
| `keep-unreleased-section` | Keeps an empty 'Unreleased' section in the output changelog after bumping the input changelog's 'Unreleased' section. Must be `true` or `false`. | `false` |
| `fail-on-empty-release-notes` | If this input is `true` then the action will fail if it detects an empty 'Unreleased' section in the input changelog. Must be `true` or `false`. | `false` |

### The `version` input

The `version` input must be one of the following values.

| Value | Effect on the latest release (`1.2.3` in these examples) |
| --- | --- |
| `major` | `2.0.0` |
| `minor` | `1.3.0` |
| `patch` | `1.2.4` |
| `premajor` | `2.0.0-0`, or `2.0.0-<preid>.0` if `preid` is specified |
| `preminor` | `1.3.0-0`, or `1.3.0-<preid>.0` |
| `prepatch` | `1.2.4-0`, or `1.2.4-<preid>.0` |
| `prerelease` | If the latest release is a prerelease then its prerelease number is incremented (`1.2.4-0` becomes `1.2.4-1`), otherwise it behaves like `prepatch` |
| `release` | Removes the prerelease part of the latest release: `1.2.4-beta.1` becomes `1.2.4`. The action fails if the latest release is not a prerelease |

These values are interpreted by the [`semver.inc`](https://github.com/npm/node-semver#functions) function; refer to its
documentation for more details.

Alternatively, specify an explicit semantic version, e.g. `2.1.0`. The explicit version must be greater than the
latest release in the changelog, otherwise the action fails.

If the changelog does not contain any releases yet then the calculation starts from `0.0.0`, so `release` cannot be
used until there is a prerelease.

## Action outputs

The following outputs can be used by subsequent workflow steps.

| Name | Description |
| --- | --- |
| `version` | The release version that was calculated from the changelog and the input parameters, and was used to update the changelog. |
| `release-notes` | The markdown content of the previously unreleased changelog section. |

Step outputs can be accessed as in the following example. Note that in order to read the step outputs the action step
must have an id.

```yml
    - name: Update changelog
      id: update-changelog
      uses: release-flow/keep-a-changelog-action@v3
      with:
        command: bump
        version: minor

    - name: Display version number
      run: |
        echo "New release version: ${{ steps.update-changelog.outputs.version }}"
```

## Changelog format

The changelog must follow the [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) conventions:

- Each release is a level 2 heading (`##`). The first release heading must be `Unreleased`, which is case-insensitive.
  The command fails if the changelog has no `Unreleased` section, or if it is not the first release section.

- Release headings are in the form `## [1.2.3] - 2022-03-03` or `## 1.2.3 - 2022-03-03`. The version must be a valid
  semantic version and the date must be in `yyyy-MM-dd` format. Any text after the date is preserved as the release
  "suffix", for example `## [0.0.5] - 2014-12-13 [YANKED]`.

- Releases are listed with the latest release first. The latest release is the first release heading after
  `Unreleased`.

- The link definitions at the end of the changelog are regenerated every time a changelog is bumped: any existing
  definitions are removed, and new ones are written for the `Unreleased` section and every release.

If the changelog does not conform then the command fails and the problems are listed in the step log.

### Link definitions

The link definitions are generated for GitHub repository URLs. In the action the repository is taken from the
`GITHUB_REPOSITORY` environment variable (which GitHub sets automatically), and the action fails if it is not set. Each
release links to a comparison with the previous release, using the tag prefix to form the tag names, for example
`https://github.com/<owner>/<repo>/compare/v1.2.2...v1.2.3`. The oldest release links to its release tag, and
`Unreleased` is compared with `HEAD`.
