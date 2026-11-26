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

Installing also sets up the Git hooks in `lefthook.yml` (via the `prepare` script, which runs
[`lefthook install`](https://lefthook.dev/)):

- **pre-commit** runs `oxlint --deny-warnings` (so warnings block the commit) on staged
  `{src,scripts}/**/*.{js,jsx,ts,tsx}` files and `prettier --check` on staged `*.ts` files. Fix formatting with
  `npm run format`.
- **pre-push** rebuilds `dist/` and fails if it differs from what is committed, like `check-dist.yml` does. The rebuilt
  files are left in your working tree, ready to commit.

Skip the hooks for one command with `LEFTHOOK=0` or `--no-verify`. Put personal overrides in `lefthook-local.yml`. If
you are upgrading a checkout that used husky, run `git config --unset core.hooksPath` and then `npx lefthook install`.

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
| `scripts/release.ts`            | Release tooling (see [Releasing](#releasing)), run directly by Node; not bundled     |

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
| `npm run lint`             | `oxlint` on `src/` and `scripts/`; fails on warnings as well as errors     |
| `npm run check-scripts`    | Type-check `scripts/` and run its `node:test` tests                        |
| `npm run package`          | Bundle `lib/` into `dist/` and `dist/cli/` with `@vercel/ncc`              |
| `npm run all`              | build, format-check, lint, test, check-scripts and package; run first      |
| `npm run release`          | Release tooling: `npm run release -- prepare <type>` (see below)           |

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
- `oxlint` is the linter (configured in `.oxlintrc.json`). It runs with `--deny-warnings`, so warnings fail the
  `lint` script and the pre-commit hook just as errors do.
- Markdown follows `.markdownlint.json` (120-column lines; code blocks and tables exempt).

## Changelog and versioning

- Record every user-visible change under `## [Unreleased]` in `CHANGELOG.md` (`### Added`, `### Changed`, ...).
  Prefix breaking changes with `**BREAKING**:`. The link definitions at the bottom are generated by the release
  process; do not edit them manually.
- Development follows [Release Flow](https://release-flow.io): changes land on `main` through pull requests from
  `feature/<name>` and `bugfix/<issue>-<name>` branches (e.g. `bugfix/98-oldest-release-notes-definitions`; include
  the issue number whenever there is one). Releases are tagged `vX.Y.Z`, and a floating major tag (`v1`, `v2`,
  `v3`...) always points at the latest non-prerelease of that major version, which is what users reference in
  workflows.
- The `version` in `package.json` and `package-lock.json` is the latest release. `npm run release -- prepare` sets
  it, and the release workflows refuse a release whose `package.json`, `package-lock.json` and latest changelog
  release disagree. Don't change it by hand.

## Releasing

A release takes four steps. Only the first runs on your machine.

1. **Prepare.** `npm run release -- prepare <type>` opens a release pull request from a `chore/release-<version>`
   branch. The PR moves the `[Unreleased]` changelog entries into a new release section and sets the version in
   `package.json` and `package-lock.json`.
2. **Merge.** CI checks the pull request. When you merge it, a **draft** GitHub release `v<version>` is created at the
   merge commit.
3. **Publish the release.** Review the draft and publish it. GitHub Actions verifies the tag, moves the floating major
   tag (stable releases only) and stages the npm package.
4. **Publish the npm package.** `npm stage publish` only *stages* the package. A maintainer must publish it on
   npmjs.com before users can install it.

You need the admin or maintain role on the repository to prepare, merge and publish a release.

### Versions

Versions follow [Semantic Versioning](https://semver.org/). Prereleases must take the form `X.Y.Z-alpha.N`,
`X.Y.Z-beta.N` or `X.Y.Z-rc.N`, numbered from 0. A new version must be greater than every existing tag, release (drafts
included) and changelog entry.

| Type                                 | From `1.2.3`                                 | Notes                              |
| ------------------------------------ | -------------------------------------------- | ---------------------------------- |
| `major` / `minor` / `patch`          | `2.0.0` / `1.3.0` / `1.2.4`                  |                                    |
| `premajor` / `preminor` / `prepatch` | `2.0.0-rc.0` / `1.3.0-rc.0` / `1.2.4-rc.0`   | Needs `--preid alpha\|beta\|rc`    |
| `prerelease`                         | from `1.3.0-rc.0`: `1.3.0-rc.1`              | Increments the current prerelease  |
| `release`                            | from `1.3.0-rc.1`: `1.3.0`                   | The latest must be a prerelease    |
| `manual`                             | whatever `--version` says                    | e.g. `--version 2.0.0-beta.0`      |

### Before you start

- Node.js 24 or later, and npm.
- The [GitHub CLI](https://cli.github.com/), logged in with `gh auth login`. If you aren't logged in, the script offers
  to run the login for you. It never reads your token.
- A clean checkout of `main` that matches `origin/main`, with `dist/` up to date.
- User-facing changes recorded under `## [Unreleased]` in `CHANGELOG.md`. A release with no notes is refused.

The script bumps the changelog with this repository's own committed `dist/cli/index.js`, so it uses the `kac` that is
on `main`.

### 1. Prepare

Run a dry run first. It shows the new version, the changelog diff, the release notes and the commands it would run.
It changes nothing, apart from fetching `main` from `origin`.

```sh
npm run release -- prepare minor --dry-run
```

Then run the same command without `--dry-run`. The script asks for confirmation before it changes anything.

```sh
npm run release -- prepare minor
npm run release -- prepare preminor --preid rc
npm run release -- prepare manual --version 4.0.0
```

The script:

1. checks the tools, your GitHub login and role, the working tree, and that no release PR is already open;
2. works out the version on a temporary copy of the changelog and checks it is newer than every existing release;
3. creates `chore/release-<version>` from `origin/main`, updates `CHANGELOG.md`, and runs `npm version` to set the
   version in `package.json` and `package-lock.json`;
4. runs `npm ci`, `npm run all` and checks `dist/` is unchanged (`--skip-checks` skips them; CI runs them anyway);
5. commits (with your usual signing settings), pushes, and opens the pull request with the `release` label;
6. switches back to `main`.

Other options: `--yes` skips the confirmation prompt. Without a terminal, `--yes` is required.

If a step fails, the script says how far it got and how to clean up. It never force-pushes or deletes remote branches.

### 2. Merge

The **Release PR check** job in `ci.yml` checks that the branch name, `package.json`, `package-lock.json` and the
changelog all show the same version, and that the version is still newer than every release. Merge the pull request
once CI passes.

`release-pr-merged.yml` then checks that the PR's author and the person who merged it both have the admin or maintain
role, checks the version again, and creates the draft release with the changelog notes (from `command: query`),
marked as a prerelease when the version has a prerelease part.

### 3. Publish the release

Open the draft release (the workflow run's summary links to it), review it, and choose **Publish release**. This
creates the `v<version>` tag at the merge commit. Don't change the tag or target.

`release-published.yml` then:

- checks that the tag is on `main`, that `package.json`, `package-lock.json` and the changelog match the tag, and that
  the release's prerelease flag matches the version;
- moves the floating major tag `vN` to the release (skipped for prereleases);
- builds and runs `npm stage publish --provenance` with the `latest` dist-tag, or `next` for prereleases.

### 4. Publish the npm package

Sign in to npmjs.com (or use the npm CLI) with an account that has publish rights to `@release-flow/keep-a-changelog`,
find the staged version, and publish it. The release is not complete until this is done.

### Troubleshooting

- `release-pr-merged.yml` only acts on merged PRs from a `chore/release-<version>` branch in this repository with the
  `release` label.
- `npm run release -- verify <version>` checks `package.json`, `package-lock.json` and `CHANGELOG.md` locally, as the
  workflows do.
- A failed `release-published.yml` can be re-run from the Actions tab; moving the major tag is idempotent.

### One-off repository setup

These settings live in GitHub, not in this repository.

- npm trusted publishing (OIDC) is configured for the package on npmjs.com.
- **Rulesets → `main`**: require a pull request and the status checks *Build & Test* and *Release PR check*; block
  force pushes and deletion.
- **Settings → Actions → General**: set the workflow permissions to read-only. The workflows ask for what they need.
- The `RELEASEBOT_APP_ID` and `RELEASEBOT_PRIVATE_KEY` secrets and their GitHub App are no longer used: the release PR
  is opened with your own `gh` login, so it triggers CI.
