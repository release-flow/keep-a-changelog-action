# Development guide

This repository contains `@release-flow/keep-a-changelog`, which provides two things from a single code base:

- A **GitHub Action** (`action.yml`, runs `dist/index.js` on `node24`).
- A **command-line tool** called `kac` (`dist/cli/index.js`), published to npm.

Both expose two commands that operate on a [Keep a Changelog](https://keepachangelog.com) file:

- `bump` converts the `## [Unreleased]` section into a new release, calculating the next version and regenerating the
  link definitions.
- `query` extracts the release notes, date and suffix for a given version.

## Prerequisites

- Node.js 24 or later (see `.nvmrc`).
- npm. The project uses `package-lock.json`, and CI installs with `--legacy-peer-deps`.

```sh
npm ci --legacy-peer-deps
```

Installing also sets up [husky](https://typicode.github.io/husky/); the pre-commit hook runs `lint-staged`, which
runs `oxlint` on staged `src/**/*.{js,jsx,ts,tsx}` files.

## Project layout

| Path                            | Purpose                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| `action.yml`                    | Action metadata: inputs, outputs and the `dist/index.js` entry point                 |
| `src/index.ts`                  | Action entry point; dispatches on the `command` input                                |
| `src/action-bump.ts`            | Action adapter for `bump` (reads inputs, calls `commands.ts`, sets outputs)          |
| `src/action-query.ts`           | Action adapter for `query`                                                           |
| `src/cli.ts`                    | `kac` entry point (yargs), with `cli-bump.ts`, `cli-query.ts` and `cli-types.ts`     |
| `src/commands.ts`               | Core `bump()` and `query()` implementations, built as unified/remark pipelines       |
| `src/options.ts`                | `BumpOptions` and `QueryOptions`                                                     |
| `src/release-link-generator.ts` | Generates compare/release link URLs                                                  |
| `src/plugins/`                  | Individual remark plugins used by the pipelines                                      |
| `src/__tests__/`                | Jest tests, helpers and markdown fixtures                                            |
| `dist/`                         | **Committed** ncc bundles: the action in `dist/`, the CLI in `dist/cli/`             |
| `lib/`                          | Gitignored `tsc` output; tests run against this                                      |
| `docs/`                         | User documentation (`bump.md`, `query.md`, `cli.md`, `upgrade-v2.md`) and this guide |

### The bump pipeline

`commands.ts` runs these plugins in order:

1. `releaseParser`
2. `preprocess`
3. `checkUnreleasedSectionExists`
4. `assert`
5. `bridge('releaseNotes', extractReleaseNotes)`
6. `calculateNextRelease`
7. `incrementRelease`
8. `addEmptyUnreleasedSection` (only when `keepUnreleasedSection` is set)
9. `updateLinkDefinitions`
10. `stringify`

## npm scripts

| Script                     | What it does                                                               |
| -------------------------- | -------------------------------------------------------------------------- |
| `npm run build`            | Compile `src/` to `lib/` with `tsc`                                        |
| `npm test`                 | Run Jest against `lib/` (requires a prior build)                           |
| `npm run build-and-test`   | Incremental build, then test; the quick inner loop                         |
| `npm run rebuild-and-test` | Clean, build, then test                                                    |
| `npm run clean`            | Remove `lib/`                                                              |
| `npm run format`           | Prettier write for `**/*.ts`                                               |
| `npm run format-check`     | Prettier check for `**/*.ts`                                               |
| `npm run lint`             | `oxlint` on `src/**/*.ts`                                                  |
| `npm run package`          | Bundle `lib/` into `dist/` and `dist/cli/` with `@vercel/ncc`              |
| `npm run all`              | build, format-check, lint, test and package; run this before pushing       |

## Build and `dist/`

`dist/` is committed because GitHub runs the action straight from the repository. After changing anything in `src/`
(or dependencies), run `npm run all` and commit the regenerated `dist/` together with the source change.

CI (`ci.yml` and `check-dist.yml`) rebuilds and fails the pull request if `dist/` differs from what was committed
(source maps are ignored). Do not edit `dist/` by hand.

## Testing

- Jest 30 runs as native ESM (`--experimental-vm-modules`) against the **compiled** `lib/**/*.test.js`, so always
  build first (`npm run build-and-test`).
- Tests in `src/__tests__/` invoke the action script or the CLI as a child process (helpers in `test-utils.ts`) and
  compare the written changelog with an expected markdown fixture using the `jest-file-diff.ts` matcher.
- To add a case, add an input fixture and an `*_expected*.md` fixture beside the tests and add a test that invokes
  the action/CLI with them. Generated `*_changed.md` files are gitignored.

## Code style

- TypeScript, strict, ESM with `NodeNext` resolution: relative imports **must** use the `.js` extension.
- Prettier: 120 columns, single quotes, ES5 trailing commas. Only `**/*.ts` is formatted by the scripts.
- `oxlint` is the linter (configured in `.oxlintrc.json`); most rules are warnings and do not fail the script.
- Markdown follows `.markdownlint.json` (120-column lines; code blocks and tables exempt).

## Changelog and versioning

- Record every user-visible change under `## [Unreleased]` in `CHANGELOG.md` (`### Added`, `### Changed`, ...).
  Prefix breaking changes with `**BREAKING**:`. The link definitions at the bottom are generated by the release
  process; do not edit them manually.
- Development follows [Release Flow](https://release-flow.io): changes land on `main` through pull requests from
  `feature/<name>` branches. Releases are tagged `vX.Y.Z`, and a floating major tag (`v1`, `v2`, `v3`...) always
  points at the latest non-prerelease of that major version, which is what users reference in workflows.
- The `version` in `package.json` is a placeholder; the real version is injected at publish time.

## Releasing

A release is driven by three workflows, with two points where a person must act.

### Prerequisites

- `main` is green, `dist/` is up to date and `## [Unreleased]` in `CHANGELOG.md` describes the release.
- The repository secrets `RELEASEBOT_APP_ID` and `RELEASEBOT_PRIVATE_KEY` exist (a GitHub App token is used so the
  release PR triggers CI, which the default `GITHUB_TOKEN` would not).
- npm trusted publishing (OIDC) is configured for the package on npmjs.com.

### 1. Prepare the release

1. In GitHub, open **Actions**, select **[autorelease] Prepare release PR** and choose **Run workflow**.
2. Pick `release-type` (`major`, `minor`, `patch`, `premajor`, `preminor`, `prepatch` or `prerelease`; default
   `patch`). For prereleases, optionally set `preid` (for example `alpha`).
3. The workflow runs this action (`uses: ./`, `command: bump`) and opens a pull request titled
   `[autorelease] Release X.Y.Z` from branch `autorelease/X.Y.Z`, labelled `autorelease`. It contains only the
   changelog change; the release notes are in the PR description.
4. Review the PR and wait for CI (it runs for `autorelease/*` branches).

### 2. Perform the release

1. **Merge the PR.** `pr-merged.yml` validates the branch name, extracts the release notes with `command: query` and
   creates a **draft** GitHub release `vX.Y.Z` (marked prerelease when the version has a prerelease part).
2. **Review and publish the draft release** in GitHub Releases.
3. Publishing triggers `release-published.yml`, which:
   - moves the floating major tag `vN` to the release (skipped for prereleases);
   - builds, sets the package version from the tag, and runs `npm stage publish --provenance` with the `latest`
     dist-tag, or `next` for prereleases.
4. **Manual step: publish the staged npm package.** `npm stage publish` only *stages* the package; it is not
   available to users until a maintainer approves it. Sign in to npmjs.com (or use the npm CLI) with an account that
   has publish rights to `@release-flow/keep-a-changelog`, find the staged version, and publish it. The release is not
   complete until this is done.

### Troubleshooting

- The release branch must match `^autorelease/[A-Za-z0-9.+-]+$` and contain a valid SemVer version, or
  `pr-merged.yml` fails.
- If the prepare workflow produces an unexpected result, remember it runs the committed `dist/` of the branch it is
  started from.
- A failed `release-published.yml` can be re-run from the Actions tab; moving the major tag is idempotent.
