# Keep a Changelog Prepare Release

A GitHub Action to update a changelog that adheres to [keep-a-changelog](https://keepachangelog.com/en/1.0.0/) and
[Semantic Versioning](https://semver.org/) conventions.

This action will:

- Validate that the changelog adheres to the conventions.

- Determine the current release number based on the release history in the changelog.

- Calculate the next release number by incrementing the current release number based on input parameters.

- Convert the 'Unreleased' section of the changelog to the next release number.

- Re-generate the link definitions at the end of the changelog.

## Usage

```yml
    - uses: actions/checkout@v3

    - name: Update changelog
      uses: release-flow/keep-a-changelog-action/prepare-release@v1
```

You can also pin to a [specific release](https://github.com/release-flow/keep-a-changelog-action/releases) version in
the format `@v1.x.x`.

### Action inputs

| Name | Description | Default |
| --- | --- | --- |
| `release-type` | Specifies how the release number is incremented. Must be one of: `major`, `premajor`, `minor`, `preminor`, `patch`, `prepatch`, or `prerelease`. See the documentation of `node-semver`'s [inc function](https://github.com/npm/node-semver#functions) for how the values work. | **Required parameter** |
| `prerelease-identifier` | The identifier to use as part of the prerelease string, if the new version is a prerelease version. For example, it would specify the `beta` in `1.0.0-beta.1`. | Empty string |
| `release-date` | The release date that is written into the changelog for the new release, in ISO 8601 format, e.g. `2022-03-03`. | Current date |
| `tag-prefix` | The prefix that is applied to the release number to generate the release tag. | `v` |
| `changelog` | The path to the changelog to modify. If a relative path is specified, it is appended to the GitHub workspace path. | `CHANGELOG.md` |
| `output-file` | The name of the modified changelog file, which is written to the same directory as the input changelog. If not specified, the input changelog is overwritten. Note this must not contain a path, just a filename. | Empty string |

### Action outputs

The following outputs can be used by subsequent workflow steps.

| Name | Description |
| --- | --- |
| `release-version` | The release version that was calculated from the changelog and the input parameters, and was used to update the changelog. |
| `release-notes` | The markdown content of the previously unreleased changelog section. |

Step outputs can be accessed as in the following example. Note that in order to read the step outputs the action step
must have an id.

```yml
    - name: Update changelog
      id: update-changelog
      uses: release-flow/keep-a-changelog-action/prepare-release@v1
      with:
        release-type: minor

    - name: Display version number
      run: |
        echo "New release version: ${{ steps.update-changelog.outputs.release-version }}"
```
