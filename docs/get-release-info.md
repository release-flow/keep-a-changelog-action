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
      uses: release-flow/keep-a-changelog-action/get-release-info@v1
      with:
        release-version: latest

    - name: Display release info
      run: |
        echo "$Version: {{ steps.get-release-info.outputs.release-version }}"
        echo "$Date: {{ steps.get-release-info.outputs.release-date }}"
        echo "${{ steps.get-release-info.outputs.release-notes }}"
```

### Action inputs

| Name | Description | Default |
| --- | --- | --- |
| `release-version` | The version for which to extract the release information. See below.  | `latest` |
| `changelog` | The path to the changelog to examine. If a relative path is specified, it is appended to the GitHub workspace path. | `CHANGELOG.md` |
| `strict` | If true, the 'latest' version will error unless a release is present in the changelog. If false, the unreleased section may be returned as 'latest' as long as no genuine releases are present. | `false` |

#### The `release-version` input

The `release-version` input can be a valid semantic version string, or one of the following values: `latest`,
`unreleased`, or `latest-or-unreleased`.

- `latest` gets the most recent release. On exit, the `version-number` output is set to the latest version number.

- `unreleased` gets the details of unreleased changes. On exit, the `version-number` output is set to `[unreleased]`.

- `latest-or-unreleased` is a combination of the other two: if any releases are present, it behaves like `latest`, but
  if the changelog only contains unreleased information then it behaves like `unreleased`.

### Action outputs

The following outputs can be used by subsequent workflow steps.

| Name | Description |
| --- | --- |
| `release-version` | The version number of the release that was located, or `[unreleased]` if information was requested about the unreleased changes. |
| `release-date` | The release date in the form `yyyy-MM-dd`, or blank if information was requested about the unreleased changes. |
| `release-notes` | The markdown content of the specified changelog section. |
