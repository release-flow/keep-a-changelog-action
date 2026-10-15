# Upgrading to V2 Action

The upgrade to V2 is a breaking change. This document describes the steps to upgrade your workflows from V1 to V2.

> **Note**: The current major version is V3, which has the same inputs and outputs as V2 but requires a runner that
> supports Node 20 or later (see the [changelog](../CHANGELOG.md)). After following the steps below, use
> `release-flow/keep-a-changelog-action@v3`.

## 1. Rename the `uses` action name

In your workflows, wherever you refer to an action as `release-flow/keep-a-changelog-action/<action-name>@v1`, change it
to refer to `release-flow/keep-a-changelog-action@v2` (or `@v3`) instead.

## 2. Add the `command` input

For each of the affected workflow steps in the previous example, add a `command` input variable. The table below shows
which value to use for the `command` input, depending on which old action you are replacing.

| Old action | New command |
| --- | --- |
| `get-release-info` | `query` |
| `get-release-notes` | `query` |
| `prepare-release` | `bump` |

## 3. Rename inputs and outputs

Certain inputs and outputs have been renamed - you will need to rename all occurrences in your workflow. The table below
shows the old and the new names for the inputs / outputs.

| Type | Old name | New name | Applies to |
| --- | --- | --- | --- |
| Input or Output | `release-version` | `version` | `bump` and `query` |
| Input | `prerelease-identifier` | `preid` | `bump` |

The `changelog` input and the `release-notes` output have the same names as before.

## Example

### Converting `release-flow/keep-a-changelog-action/get-release-info@v1`

```yml
    - name: Get release info
      id: get-release-info
      uses: release-flow/keep-a-changelog-action/get-release-info@v1
      with:
        release-version: latest
```

becomes

```yml
    - name: Get release info
      id: get-release-info
      uses: release-flow/keep-a-changelog-action@v2
      with:
        command: query
        version: latest
```

The `version` input is now required, so it must be specified even when you want the latest release (which was the
default in V1).

### Converting `release-flow/keep-a-changelog-action/prepare-release@v1`

```yml
    - name: Update changelog
      id: update-changelog
      uses: release-flow/keep-a-changelog-action/prepare-release@v1
      with:
        release-type: ${{ github.event.inputs.release-type }}
        prerelease-identifier: ${{ github.event.inputs.prerelease-identifier }}
```

becomes

```yml
    - name: Update changelog
      id: update-changelog
      uses: release-flow/keep-a-changelog-action@v2
      with:
        command: bump
        version: ${{ github.event.inputs.release-type }}
        preid: ${{ github.event.inputs.prerelease-identifier }}
```
