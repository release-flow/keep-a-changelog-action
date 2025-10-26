# Keep a Changelog Action: Bump Command

The `bump` command updates a changelog by converting the `[Unreleased]` section to the latest release number. The release
number is automatically incremented according to the action parameters. The command operates as follows:

- Validates that the changelog adheres to the conventions.

- Determines the current release number based on the release history in the changelog.

- Calculates the next release number by incrementing the current release number based on input parameters.

- Converts the `[Unreleased]` section of the changelog to the next release number.

- Re-generates the link definitions at the end of the changelog.

## Usage

```yml
    - uses: actions/checkout@v3

    - name: Bump changelog version
      uses: release-flow/keep-a-changelog-action@v2
      with:
        command: bump
        version: patch
```

## Action inputs

| Name | Description | Default |
| --- | --- | --- |
| `command` | Must contain the value `bump`  | n/a |
| `version` | Specifies how the release number is incremented. Must be one of: `major`, `premajor`, `minor`, `preminor`, `patch`, `prepatch`, `prerelease`, or `release`. See the documentation of the [`semver.inc`](https://github.com/npm/node-semver#functions) function for more details. | **Required parameter** |
| `preid` | The "prerelease identifier" to use as a prefix for the "prerelease" part of a semver. For example, it would specify the 'beta' in '1.0.0-beta.1'. | Empty string |
| `release-date` | The release date that is written into the changelog for the new release, in ISO 8601 format, e.g. `2022-03-03`. | Current date |
| `tag-prefix` | The prefix that is applied to the release number to generate the release tag. | `v` |
| `changelog` | The path to the changelog to modify. If a relative path is specified, it is appended to the GitHub workspace path. | `CHANGELOG.md` |
| `output-file` | The name of the modified changelog file, which is written to the same directory as the input changelog. If not specified, the input changelog is overwritten. Note this must not contain a path, just a filename. | Empty string |
| `keep-unreleased-section` | Keeps an empty 'Unreleased' section in the output changelog after bumping the input changelog's 'Unreleased' section. | `false` |
| `fail-on-empty-release-notes` | If this input is true then the action will report an error if it detects an empty 'Unreleased' section in the input changelog. | `false` |

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
      uses: release-flow/keep-a-changelog-action/prepare-release@v1
      with:
        command: bump
        version: minor

    - name: Display version number
      run: |
        echo "New release version: ${{ steps.update-changelog.outputs.version }}"
```
