# Keep a Changelog: Command line

The same commands that are available in the GitHub Action are also available from the command line, as the `kac` tool
in the [`@release-flow/keep-a-changelog`](https://www.npmjs.com/package/@release-flow/keep-a-changelog) npm package.
Node.js 24 or later is required.

```sh
# Run without installing
npx @release-flow/keep-a-changelog query --version latest

# Or install globally and use the `kac` command
npm install --global @release-flow/keep-a-changelog
kac bump --version minor
```

The `kac` tool takes a command (`bump` or `query`), followed by options. See [bump](./bump.md) and [query](./query.md)
for a description of what the commands do and of the [changelog format](./bump.md#changelog-format) they expect.

## `kac bump`

Converts the `[Unreleased]` section to a new release. The changelog is overwritten unless `--output-file` is specified.

| Option | Alias | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `--changelog` | `-c` | string | `CHANGELOG.md` | The path to the changelog. A relative path is resolved against the current directory. |
| `--version` | `-v` | string | n/a (**required**) | How the release number is incremented: `major`, `premajor`, `minor`, `preminor`, `patch`, `prepatch`, `prerelease` or `release`, or an explicit semantic version that is greater than the latest release. `release` fails unless the latest release is a prerelease. See the [`version` input](./bump.md#the-version-input). |
| `--release-date` | `-r` | string | Current date | The release date written into the changelog, in ISO 8601 format, e.g. `2022-03-03`. |
| `--preid` | `-p` | string | Empty | The prerelease identifier, e.g. `beta` for `1.0.0-beta.1`. |
| `--tag-prefix` | `-t` | string | `v` | The prefix applied to the release number to generate the release tag used in link definitions. |
| `--output-file` | `-o` | string | Input file | The name of the modified changelog file, relative to the input changelog's directory. |
| `--keep-unreleased-section` | `-k` | boolean | `false` | Keep an empty `[Unreleased]` section at the top of the output changelog. |
| `--fail-on-empty-release-notes` | `-f` | boolean | `false` | Fail if the `[Unreleased]` section is empty. |
| `--github-repo` | `-g` | string | Empty | The GitHub repository, in the form `owner/repo`, used to generate the link definitions at the end of the changelog. If empty, no link definitions are written. |

Unlike the action, the CLI cannot discover the repository from the environment, so `--github-repo` must be supplied if
the changelog should contain link definitions. Any existing link definitions are removed and, if `--github-repo` is
specified, regenerated.

Boolean options are switches (`--keep-unreleased-section`), and can be negated with `--no-` (for example
`--no-keep-unreleased-section`).

```sh
kac bump --version minor --github-repo release-flow/keep-a-changelog-action --keep-unreleased-section
```

The command prints nothing on success, apart from any warnings about the changelog's contents.

## `kac query`

Extracts information about a release and writes it to standard output as JSON.

| Option | Alias | Type | Default | Description |
| --- | --- | --- | --- | --- |
| `--changelog` | `-c` | string | `CHANGELOG.md` | The path to the changelog. A relative path is resolved against the current directory. |
| `--version` | `-v` | string | n/a (**required**) | The release to query: a semantic version, or one of `latest`, `unreleased` or `latest-or-unreleased`. See the [`version` input](./query.md#the-version-input). |

The JSON output has the following properties:

| Name | Description |
| --- | --- |
| `version` | The version of the release that was matched, or `[unreleased]` for the unreleased changes. |
| `release-date` | The release date in the form `yyyy-MM-dd`, or `null` for the unreleased changes. |
| `release-suffix` | The text that follows the date in the release heading, e.g. `[YANKED]`, or an empty string. |
| `release-notes` | The markdown content of the release section. |
| `report` | A text report of any warnings that were found in the changelog, or `null`. |

```sh
kac query --version latest | jq -r '.["release-notes"]'
```

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Success. |
| `255` (`-1`) | The changelog is invalid, or the requested operation failed (for example, the release was not found). |
| `254` (`-2`) | An unexpected error occurred. |
| `253` (`-3`) | An option has an invalid value (for example, a malformed `--version` or `--release-date`). |

Errors are written to standard error. A missing required option is reported by the argument parser, with usage
information.
