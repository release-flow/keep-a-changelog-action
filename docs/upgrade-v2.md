# Upgrading to V2 Action

The upgrade to V2 is a breaking change. This document describes the steps to upgrade your workflows to V2.

## 1. Rename the `uses` action name

In your workflows, wherever you refer to an action as `release-flow/keep-a-changelog-action/<action-name>@V1`, change it
to refer to `release-flow/keep-a-changelog-action@V2` instead.

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

## Example

### Converting `release-flow/keep-a-changelog-action/get-release-info@v1`

```yml
    - name: Update changelog
      id: update-changelog
      uses: release-flow/keep-a-changelog-action/get-release-info@v1
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
