# CLAUDE.md

`@release-flow/keep-a-changelog`: a GitHub Action and `kac` CLI that `bump`s and `query`s Keep a Changelog files.
Full details, including how to release, are in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Commands

```sh
npm ci --legacy-peer-deps   # install (Node 24, see .nvmrc)
npm run build-and-test      # quick loop: tsc --incremental, then jest
npm run all                 # build, format-check, lint, test, package (ncc -> dist/)
npm run format              # prettier --write **/*.ts
```

## Gotchas

- Tests run against compiled `lib/`, so **build before `npm test`**.
- `dist/` is committed and CI fails if it is stale: run `npm run all` and commit `dist/` with any `src/` or
  dependency change. Never edit `dist/` by hand.
- ESM with `NodeNext`: relative imports in `src/` need the `.js` extension.
- Linting is `oxlint` (not ESLint); formatting is Prettier (120 cols, single quotes) for `**/*.ts` only.
- Add user-visible changes under `## [Unreleased]` in `CHANGELOG.md`; use `**BREAKING**:` for breaking changes. Don't
  hand-edit the generated link definitions.
- `package.json` version is a placeholder; the release workflow sets the real version.

## Layout

- `action.yml`: inputs/outputs; entry `dist/index.js` (`node24`).
- `src/index.ts` dispatches to `action-bump.ts` / `action-query.ts`; `src/cli.ts` (+ `cli-*.ts`) is the yargs CLI.
- `src/commands.ts`: core `bump()` / `query()` as unified/remark pipelines; plugins live in `src/plugins/`.
- `src/__tests__/`: Jest tests that spawn the action/CLI and diff against markdown fixtures.
- `docs/`: user docs (`bump.md`, `query.md`, `cli.md`, `upgrade-v2.md`) and the development guide. Keep them in sync
  with `action.yml` and the yargs options in `src/cli.ts` when inputs/options change.

## Releasing

Run the "[autorelease] Prepare release PR" workflow, merge the generated PR, publish the draft release, then
**manually publish the staged npm package** (the workflow only runs `npm stage publish`). See
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#releasing).
