# Keep a Changelog Get Release Notes

A GitHub Action to extract release notes from a changelog that adheres to
[keep-a-changelog](https://keepachangelog.com/en/1.0.0/) and [Semantic Versioning](https://semver.org/) conventions.

This action will:

- Validate that the changelog adheres to the conventions.

- Extract the release notes from the specified release version. If the version is not present, the action will fail.

## Usage

```yml
    - uses: actions/checkout@v2

    - name: Get release notes
      id: get-release-notes
      uses: release-flow/keep-a-changelog-action/get-release-notes@v1
      with:
        release-version: 1.0.1-beta.2

    - name: Display release notes
      run: |
        echo "${{ steps.get-release-notes.outputs.release-notes }}"
```

Note that in order to read the step outputs the action step must have an id.

You can also pin to a [specific release](https://github.com/release-flow/keep-a-changelog-release/releases) version in
the format `@v1.x.x`.

### Action inputs

| Name | Description | Default |
| --- | --- | --- |
| `release-version` | The version for which to extract the release notes. Can be 'unreleased' to get the unreleased notes.  | `unreleased` |
| `changelog` | The path to the changelog to examine. If a relative path is specified, it is appended to the GitHub workspace path. | `CHANGELOG.md` |

### Action outputs

The following outputs can be used by subsequent workflow steps.

- `release-notes` - The markdown content of the specified changelog section.
