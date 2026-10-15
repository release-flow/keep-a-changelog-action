# Keep a Changelog Action: Query Command

The `query` command locates a specified release and extracts release information into output variables. The command:

- Validates that the changelog adheres to the [Keep-a-Changelog](https://keepachangelog.com/en/1.0.0/) conventions (see
  the [changelog format](./bump.md#changelog-format)).

- Extracts release information about the specified release version. If the changelog contains no releases, or no
  matching version is present, the action will fail.

The command is also available from the [command line](./cli.md#kac-query).

## Usage

```yml
    - uses: actions/checkout@v4

    - name: Get latest release info
      id: query-release-info
      uses: release-flow/keep-a-changelog-action@v3
      with:
        command: query
        version: latest

    - name: Display release info
      run: |
        echo "Version: ${{ steps.query-release-info.outputs.version }}"
        echo "Date: ${{ steps.query-release-info.outputs.release-date }}"
        echo "${{ steps.query-release-info.outputs.release-notes }}"
```

## Action inputs

| Name | Description | Default |
| --- | --- | --- |
| `command` | Must contain the value `query`. The action fails if it is missing or is not `bump` or `query`. | n/a |
| `version` | The version for which to extract the release information. See below. | **Required parameter** |
| `changelog` | The path to the changelog to examine. If a relative path is specified, it is appended to the GitHub workspace path. | `CHANGELOG.md` |

### The `version` input

The `version` input can be a valid semantic version string (for example `1.2.3`), or one of the following values:
`latest`, `unreleased`, or `latest-or-unreleased`.

- `latest` gets the most recent release. On exit, the `version` output is set to the latest version number.

- `unreleased` gets the details of unreleased changes. On exit, the `version` output is set to `[unreleased]`.

- `latest-or-unreleased` is a combination of the other two: if any releases are present, it behaves like `latest`, but
  if the changelog only contains unreleased information then it behaves like `unreleased`.

If the value is neither a valid semantic version nor one of the special values, the action fails.

## Action outputs

The following outputs can be used by subsequent workflow steps.

| Name | Description |
| --- | --- |
| `version` | The version number of the release that was matched, or `[unreleased]` if information was requested about the unreleased changes. |
| `release-date` | The release date in the form `yyyy-MM-dd`, or blank if information was requested about the unreleased changes. |
| `release-suffix` | The text that follows the release date in the release heading, or blank if there is none. For example, for the heading `## [0.0.5] - 2014-12-13 [YANKED]` the output is `[YANKED]`. |
| `release-notes` | The markdown content of the specified changelog section. |
