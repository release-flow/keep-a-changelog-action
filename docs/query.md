# Keep a Changelog Action: Query Command

The `query` command locates a specified release and extracts release information into output variables. The command:

- Validates that the changelog adheres to the [Keep-a-Changelog](https://keepachangelog.com/en/1.0.0/) conventions.

- Extracts release information about the specified release version. If no matching version is present, the action will
  fail.

## Usage

```yml
    - uses: actions/checkout@v3

    - name: Get latest release info
      id: query-release-info
      uses: release-flow/keep-a-changelog-action@v2
      with:
        command: query
        version: latest

    - name: Display release info
      run: |
        echo "$Version: {{ steps.query-release-info.outputs.version }}"
        echo "$Date: {{ steps.query-release-info.outputs.release-date }}"
        echo "${{ steps.query-release-info.outputs.release-notes }}"
```

## Action inputs

| Name | Description | Default |
| --- | --- | --- |
| `command` | Must contain the value `query`  | n/a |
| `version` | The version for which to extract the release information. See below.  | `latest` |
| `changelog` | The path to the changelog to examine. If a relative path is specified, it is appended to the GitHub workspace path. | `CHANGELOG.md` |

### The `version` input

The `version` input can be a valid semantic version string, or one of the following values: `latest`, `unreleased`, or
`latest-or-unreleased`.

- `latest` gets the most recent release. On exit, the `version` output is set to the latest version number.

- `unreleased` gets the details of unreleased changes. On exit, the `version` output is set to `[unreleased]`.

- `latest-or-unreleased` is a combination of the other two: if any releases are present, it behaves like `latest`, but
  if the changelog only contains unreleased information then it behaves like `unreleased`.

## Action outputs

The following outputs can be used by subsequent workflow steps.

| Name | Description |
| --- | --- |
| `version` | The version number of the release that was matched, or `[unreleased]` if information was requested about the unreleased changes. |
| `release-date` | The release date in the form `yyyy-MM-dd`, or blank if information was requested about the unreleased changes. |
| `release-notes` | The markdown content of the specified changelog section. |
