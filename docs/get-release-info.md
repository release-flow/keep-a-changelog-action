# Keep a Changelog Get Release Info

A GitHub Action to extract release information from a changelog that adheres to
[keep-a-changelog](https://keepachangelog.com/en/1.0.0/) and [Semantic Versioning](https://semver.org/) conventions.

This action will:

- Validate that the changelog adheres to the conventions.

- Extract the release notes from the specified release version. If the version is not present, the action will fail.

## Usage

```yml
    - uses: actions/checkout@v3

    - name: Get latest release info
      id: get-release-info
      uses: release-flow/keep-a-changelog-action/get-release-notes@v1
      with:
        release-version: latest

    - name: Display release notes
      run: |
        echo "${{ steps.get-release-notes.outputs.release-notes }}"
```

### Action inputs

| Name | Description | Default |
| --- | --- | --- |
| `release-version` | The version for which to extract the release information. Can be 'unreleased' to get unreleased changes (the `version-number` output is `[unreleased]`), or 'latest' to get the latest version.  | `latest` |
| `changelog` | The path to the changelog to examine. If a relative path is specified, it is appended to the GitHub workspace path. | `CHANGELOG.md` |

### Action outputs

The following outputs can be used by subsequent workflow steps.

| Name | Description |
| --- | --- |
| `release-version` | The version number of the release that was located, or `[unreleased]` if information was requested about the unreleased changes. |
| `release-date` | The release date in the form `yyyy-MM-dd`, or blank if information was requested about the unreleased changes. |
| `release-notes` | The markdown content of the specified changelog section. |
