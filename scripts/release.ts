/**
 * Release tooling for @release-flow/keep-a-changelog. Node.js built-ins only; runs with `node scripts/release.ts`.
 *
 * Operator command, run from a clean, up-to-date `main` (see docs/DEVELOPMENT.md#releasing):
 *
 *     npm run release -- prepare <type> [--preid alpha|beta|rc] [--version X.Y.Z[-(alpha|beta|rc).N]]
 *                                       [--dry-run] [--skip-checks] [--yes]
 *
 * It bumps CHANGELOG.md (with this repository's own committed `dist/cli`), sets the version in package.json and
 * package-lock.json, runs the checks, commits to a `chore/release-<version>` branch, pushes it and opens the release
 * pull request with `gh`. `--dry-run` shows what would happen and changes nothing apart from fetching from origin.
 *
 * Helpers used by the release workflows:
 *
 *     verify V                     package.json, package-lock.json and CHANGELOG.md all describe release V
 *     is-prerelease V              print true or false
 *     check-newer V --existing F   V is strictly greater than every version listed in F (one per line, '-' = stdin)
 *     parse-branch REF             print the version from a chore/release-<version> branch name
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { parseArgs } from 'node:util';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const BRANCH_PREFIX = 'chore/release-';
export const LABEL = 'release';
export const TAG_PREFIX = 'v';
export const PREIDS = ['alpha', 'beta', 'rc'];
export const RELEASE_TYPES = [
  'major',
  'minor',
  'patch',
  'premajor',
  'preminor',
  'prepatch',
  'prerelease',
  'release',
  'manual',
];
const PRE_TYPES = ['premajor', 'preminor', 'prepatch', 'prerelease'];
const PREID_REQUIRED = ['premajor', 'preminor', 'prepatch'];
const ALLOWED_ROLES = ['ADMIN', 'MAINTAIN'];
const MIN_NODE_MAJOR = 24;
const GITHUB_HOST = 'github.com';

const NUM = '(?:0|[1-9]\\d*)';
// The versions this project releases: X.Y.Z or X.Y.Z-(alpha|beta|rc).N.
const RELEASE_VERSION_RE = new RegExp(`^(${NUM})\\.(${NUM})\\.(${NUM})(?:-(alpha|beta|rc)\\.(${NUM}))?$`);
// Any SemVer 2.0 version, optionally with a tag prefix; build metadata is ignored. Used to read existing versions.
const IDENT = '(?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*)';
const SEMVER_RE = new RegExp(
  `^v?(${NUM})\\.(${NUM})\\.(${NUM})(?:-(${IDENT}(?:\\.${IDENT})*))?(?:\\+[0-9A-Za-z.-]+)?$`
);
const CHANGELOG_HEADING_RE = /^##\s+\[?([^\]\s]+)\]?/;

/** A problem the operator or CI has to fix. Reported as a message, without a stack trace. */
export class ReleaseError extends Error {
  override name = 'ReleaseError';
}

/** A semantic version, ordered by SemVer 2.0 precedence. */
export class Version {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: readonly string[];

  constructor(major: number, minor: number, patch: number, prerelease: readonly string[] = []) {
    this.major = major;
    this.minor = minor;
    this.patch = patch;
    this.prerelease = prerelease;
  }

  /** Parse any SemVer 2.0 version, with or without a leading `v`. */
  static parse(text: string): Version {
    const m = SEMVER_RE.exec(text.trim());
    if (!m) {
      throw new ReleaseError(`'${text}' is not a semantic version`);
    }
    return new Version(Number(m[1]), Number(m[2]), Number(m[3]), m[4] ? m[4].split('.') : []);
  }

  get isPrerelease(): boolean {
    return this.prerelease.length > 0;
  }

  toString(): string {
    const core = `${this.major}.${this.minor}.${this.patch}`;
    return this.isPrerelease ? `${core}-${this.prerelease.join('.')}` : core;
  }

  /** Negative, zero or positive as this version has lower, equal or higher precedence than `other`. */
  compare(other: Version): number {
    const core = this.major - other.major || this.minor - other.minor || this.patch - other.patch;
    if (core !== 0) {
      return Math.sign(core);
    }
    if (!this.isPrerelease || !other.isPrerelease) {
      // A prerelease has lower precedence than the release itself.
      return Number(other.isPrerelease) - Number(this.isPrerelease);
    }
    return comparePrerelease(this.prerelease, other.prerelease);
  }

  equals(other: Version): boolean {
    return this.compare(other) === 0;
  }
}

function comparePrerelease(a: readonly string[], b: readonly string[]): number {
  // Numeric identifiers compare numerically and sort before alphanumeric ones; a shorter list of otherwise equal
  // identifiers sorts first.
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const [x, y] = [a[i], b[i]];
    const [xNum, yNum] = [/^\d+$/.test(x), /^\d+$/.test(y)];
    if (xNum && yNum) {
      const diff = BigInt(x) - BigInt(y);
      if (diff !== 0n) {
        return diff < 0n ? -1 : 1;
      }
    } else if (xNum !== yNum) {
      return xNum ? -1 : 1;
    } else if (x !== y) {
      return x < y ? -1 : 1;
    }
  }
  return Math.sign(a.length - b.length);
}

/** Parse a version this project may release: X.Y.Z or X.Y.Z-(alpha|beta|rc).N. */
export function parseReleaseVersion(text: string): Version {
  if (!RELEASE_VERSION_RE.test(text.trim())) {
    throw new ReleaseError(
      `'${text}' is not a valid release version. Use X.Y.Z or X.Y.Z-<alpha|beta|rc>.N, with no build metadata`
    );
  }
  return Version.parse(text);
}

/** The release versions in a changelog, newest first, skipping the Unreleased section. */
export function changelogVersions(text: string): Version[] {
  const versions: Version[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = CHANGELOG_HEADING_RE.exec(line);
    if (!m || m[1].toLowerCase() === 'unreleased') {
      continue;
    }
    versions.push(Version.parse(m[1]));
  }
  return versions;
}

function readJson(file: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
}

/** The version in package.json. */
export function packageVersion(root: string): unknown {
  return readJson(path.join(root, 'package.json')).version;
}

/** Check that package.json, package-lock.json and CHANGELOG.md all describe the release `version`. */
export function verify(version: Version, root: string): void {
  const expected = version.toString();
  const problems: string[] = [];
  const found = packageVersion(root);
  if (found !== expected) {
    problems.push(`package.json has version ${String(found)}, expected ${expected}`);
  }
  const lock = readJson(path.join(root, 'package-lock.json'));
  const packages = lock.packages as Record<string, { version?: unknown }> | undefined;
  for (const [where, value] of [
    ['version', lock.version],
    ['packages[""].version', packages?.['']?.version],
  ]) {
    if (value !== expected) {
      problems.push(`package-lock.json has ${String(where)} ${String(value)}, expected ${expected}`);
    }
  }
  const releases = changelogVersions(fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8'));
  if (releases.length === 0) {
    problems.push(`CHANGELOG.md has no release sections, expected ${expected} first`);
  } else if (!releases[0].equals(version)) {
    problems.push(`the latest release in CHANGELOG.md is ${releases[0].toString()}, expected ${expected}`);
  }
  if (problems.length > 0) {
    throw new ReleaseError(problems.join('; '));
  }
}

/** Refuse `version` unless it is strictly greater than every existing version. Unparseable entries are skipped. */
export function checkNewer(version: Version, existing: Iterable<string>): void {
  let newest: Version | undefined;
  for (const raw of existing) {
    const text = raw.trim();
    if (!text) {
      continue;
    }
    let v: Version;
    try {
      v = Version.parse(text);
    } catch (e) {
      if (!(e instanceof ReleaseError)) {
        throw e;
      }
      warn(`ignoring '${text}', which is not a semantic version`);
      continue;
    }
    if (newest === undefined || v.compare(newest) > 0) {
      newest = v;
    }
  }
  if (newest !== undefined && version.compare(newest) <= 0) {
    throw new ReleaseError(
      `version ${version.toString()} is not greater than the current release ${newest.toString()}`
    );
  }
}

/** The release version named by a `chore/release-<version>` branch. */
export function parseBranch(ref: string): Version {
  if (!ref.startsWith(BRANCH_PREFIX)) {
    throw new ReleaseError(`branch '${ref}' is not a release branch (${BRANCH_PREFIX}<version>)`);
  }
  return parseReleaseVersion(ref.slice(BRANCH_PREFIX.length));
}

/** Check the `prepare` arguments. Returns the explicit version for `manual`, otherwise undefined. */
export function validateInput(releaseType: string, version?: string, preid?: string): Version | undefined {
  if (!RELEASE_TYPES.includes(releaseType)) {
    throw new ReleaseError(`unknown release type '${releaseType}' (use ${RELEASE_TYPES.join(', ')})`);
  }
  if (preid !== undefined && !PREIDS.includes(preid)) {
    throw new ReleaseError(`--preid must be one of ${PREIDS.join(', ')}`);
  }
  if (preid !== undefined && !PRE_TYPES.includes(releaseType)) {
    throw new ReleaseError(`--preid only applies to ${PRE_TYPES.join(', ')}`);
  }
  if (PREID_REQUIRED.includes(releaseType) && preid === undefined) {
    throw new ReleaseError(`${releaseType} needs --preid (${PREIDS.join(', ')})`);
  }
  if (releaseType === 'manual') {
    if (!version) {
      throw new ReleaseError('manual releases need --version');
    }
    return parseReleaseVersion(version);
  }
  if (version) {
    throw new ReleaseError('--version only applies to manual releases');
  }
  return undefined;
}

function inActions(): boolean {
  return process.env.GITHUB_ACTIONS === 'true';
}

export function warn(message: string): void {
  process.stderr.write(`${inActions() ? '::warning::' : 'warning: '}${message}\n`);
}

// --- prepare ---------------------------------------------------------------------------------------------------------

export interface CommandResult {
  status: number;
  stdout: string;
  stderr: string;
}

/**
 * Runs commands for `prepare`.
 *
 * `query` runs read-only commands, also in a dry run. `act` runs commands that change the repository or GitHub, or
 * that only make sense after such a change (the checks); in a dry run it only records them.
 */
export class Runner {
  readonly dryRun: boolean;
  readonly planned: string[][] = [];

  constructor(dryRun: boolean) {
    this.dryRun = dryRun;
  }

  query(cmd: readonly string[], opts: { cwd: string; check?: boolean }): CommandResult {
    const result = spawnSync(cmd[0], cmd.slice(1), { cwd: opts.cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const out: CommandResult = {
      status: result.error ? 127 : (result.status ?? 1),
      stdout: result.stdout ?? '',
      stderr: result.error ? result.error.message : (result.stderr ?? ''),
    };
    if ((opts.check ?? true) && out.status !== 0) {
      throw new ReleaseError(`\`${cmd.join(' ')}\` failed: ${(out.stderr || out.stdout).trim()}`);
    }
    return out;
  }

  act(cmd: readonly string[], opts: { cwd: string }): void {
    this.planned.push([...cmd]);
    if (this.dryRun) {
      return;
    }
    process.stdout.write(`$ ${cmd.join(' ')}\n`);
    const result = spawnSync(cmd[0], cmd.slice(1), { cwd: opts.cwd, stdio: 'inherit' });
    if (result.error || result.status !== 0) {
      throw new ReleaseError(`\`${cmd.join(' ')}\` failed`);
    }
  }

  interactive(cmd: readonly string[]): number {
    const result = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit' });
    return result.error ? 127 : (result.status ?? 1);
  }
}

export interface Options {
  releaseType: string;
  version?: string;
  preid?: string;
  dryRun?: boolean;
  skipChecks?: boolean;
  yes?: boolean;
}

export type Ask = (prompt: string) => Promise<string>;

export interface PrepareDeps {
  root?: string;
  runner?: Runner;
  interactive?: boolean;
  ask?: Ask;
  print?: (text: string) => void;
  which?: (tool: string) => boolean;
  verify?: (version: Version, root: string) => void;
}

function isInteractive(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

async function askTerminal(prompt: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await rl.question(prompt);
  } finally {
    rl.close();
  }
}

function onPath(tool: string): boolean {
  return (process.env.PATH ?? '').split(path.delimiter).some((dir) => {
    try {
      fs.accessSync(path.join(dir, tool), fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

function isYes(answer: string): boolean {
  return ['y', 'yes'].includes(answer.trim().toLowerCase());
}

/**
 * Make sure `gh` is logged in to GitHub, offering to run `gh auth login` in an interactive terminal.
 *
 * The token itself is never read here: `gh` handles the login and stores its own credentials.
 */
export async function ensureGhLogin(
  runner: Runner,
  opts: { interactive: boolean; yes: boolean; ask: Ask; print?: (text: string) => void }
): Promise<void> {
  const print = opts.print ?? ((text: string) => process.stdout.write(text));
  const status = ['gh', 'auth', 'status', '--hostname', GITHUB_HOST];
  if (runner.query(status, { cwd: process.cwd(), check: false }).status === 0) {
    return;
  }
  const hint = `Run \`gh auth login --hostname ${GITHUB_HOST}\` and try again.`;
  if (!opts.interactive || opts.yes) {
    throw new ReleaseError(`the GitHub CLI is not logged in to ${GITHUB_HOST}, or its token has expired. ${hint}`);
  }
  print(`The GitHub CLI is not logged in to ${GITHUB_HOST}, or its token has expired.\n`);
  if (!isYes(await opts.ask('Run `gh auth login` now? [y/N] '))) {
    throw new ReleaseError(`not logged in to GitHub. ${hint}`);
  }
  runner.interactive(['gh', 'auth', 'login', '--hostname', GITHUB_HOST, '--web']);
  if (runner.query(status, { cwd: process.cwd(), check: false }).status !== 0) {
    throw new ReleaseError(`still not logged in to GitHub. ${hint}`);
  }
}

function kacScript(root: string): string {
  return path.join(root, 'dist', 'cli', 'index.js');
}

function checkTools(root: string, which: (tool: string) => boolean): void {
  const missing = ['git', 'gh', 'npm'].filter((tool) => !which(tool));
  if (missing.length > 0) {
    throw new ReleaseError(`missing tools: ${missing.join(', ')} (see docs/DEVELOPMENT.md#releasing)`);
  }
  const major = Number(process.versions.node.split('.')[0]);
  if (major < MIN_NODE_MAJOR) {
    throw new ReleaseError(`Node.js ${MIN_NODE_MAJOR} or later is needed, found ${process.versions.node}`);
  }
  if (!fs.existsSync(kacScript(root))) {
    throw new ReleaseError(`${path.relative(root, kacScript(root))} is missing`);
  }
}

/** The `owner/repo` of origin, after checking that the operator may prepare releases. */
function githubRepo(runner: Runner, root: string): string {
  const out = runner.query(['gh', 'repo', 'view', '--json', 'nameWithOwner,viewerPermission'], { cwd: root }).stdout;
  const info = JSON.parse(out) as { nameWithOwner: string; viewerPermission: string };
  if (!ALLOWED_ROLES.includes(info.viewerPermission)) {
    throw new ReleaseError(
      `preparing a release needs admin or maintain permission on ${info.nameWithOwner}; ` +
        `you have ${info.viewerPermission}`
    );
  }
  return info.nameWithOwner;
}

function checkGitState(runner: Runner, root: string): void {
  if (runner.query(['git', 'status', '--porcelain'], { cwd: root }).stdout.trim()) {
    throw new ReleaseError('the working tree has uncommitted or untracked changes; commit or stash them first');
  }
  // No tags: the floating major tag (e.g. v3) moves, and fetching it would clash with a stale local copy. Release
  // tags are read from origin instead (existingVersions).
  runner.query(['git', 'fetch', '--no-tags', 'origin', 'main'], { cwd: root });
  const branch = runner.query(['git', 'rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root }).stdout.trim();
  if (branch !== 'main') {
    throw new ReleaseError(`releases are prepared from main, but the current branch is ${branch}`);
  }
  const head = runner.query(['git', 'rev-parse', 'HEAD'], { cwd: root }).stdout.trim();
  const upstream = runner.query(['git', 'rev-parse', 'origin/main'], { cwd: root }).stdout.trim();
  if (head !== upstream) {
    throw new ReleaseError('main is not the same as origin/main; pull or push first');
  }
}

function checkNoOpenReleasePr(runner: Runner, root: string): void {
  const cmd = ['gh', 'pr', 'list', '--label', LABEL, '--state', 'open', '--json', 'url'];
  const prs = JSON.parse(runner.query(cmd, { cwd: root }).stdout || '[]') as { url: string }[];
  if (prs.length > 0) {
    throw new ReleaseError(`a release pull request is already open: ${prs[0].url}`);
  }
}

/** Bump a copy of CHANGELOG.md in `workdir`. Returns the copy's path, the new version and its release notes. */
function bumpChangelog(
  runner: Runner,
  root: string,
  workdir: string,
  opts: Options,
  repo: string
): { changelog: string; version: string; notes: string } {
  const copy = path.join(workdir, 'CHANGELOG.md');
  fs.copyFileSync(path.join(root, 'CHANGELOG.md'), copy);
  const kac = [process.execPath, kacScript(root)];
  const versionArg = opts.releaseType === 'manual' ? String(opts.version) : opts.releaseType;
  const cmd = [...kac, 'bump', '--changelog', copy, '--version', versionArg, '--github-repo', repo];
  // Keep an empty [Unreleased] section for the next changes. A release with no notes is refused.
  cmd.push('--tag-prefix', TAG_PREFIX, '--fail-on-empty-release-notes', '--keep-unreleased-section');
  if (opts.preid) {
    cmd.push('--preid', opts.preid);
  }
  const result = runner.query(cmd, { cwd: workdir, check: false });
  if (result.status !== 0) {
    throw new ReleaseError(`kac bump failed: ${(result.stderr || result.stdout).trim()}`);
  }
  const out = runner.query([...kac, 'query', '--changelog', copy, '--version', 'latest'], { cwd: workdir }).stdout;
  const info = JSON.parse(out) as { version: string; 'release-notes'?: string };
  return { changelog: copy, version: info.version, notes: info['release-notes'] ?? '' };
}

/** Every version released or drafted so far: v* tags on origin, GitHub releases (drafts too) and the changelog. */
function existingVersions(runner: Runner, root: string, repo: string): string[] {
  const tags = runner
    .query(['git', 'ls-remote', '--tags', '--refs', 'origin', `refs/tags/${TAG_PREFIX}*`], { cwd: root })
    .stdout.split('\n')
    .map((line) => line.split('\t')[1]?.replace(/^refs\/tags\//, '') ?? '')
    .filter((tag) => !/^v\d+$/.test(tag)); // the floating major tags
  const releases = runner
    .query(['gh', 'api', `repos/${repo}/releases`, '--paginate', '--jq', '.[].tag_name'], { cwd: root })
    .stdout.split(/\s+/);
  const changelog = changelogVersions(fs.readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')).map((v) =>
    v.toString()
  );
  return [...tags, ...releases, ...changelog];
}

export function prBody(version: Version, notes: string): string {
  const tag = `${TAG_PREFIX}${version.toString()}`;
  const majorTag = version.isPrerelease ? '' : ` moves the \`${TAG_PREFIX}${version.major}\` tag to it and`;
  return (
    `Prepares release ${version.toString()}.\n\n` +
    `> [!WARNING]\n` +
    `> Merging this pull request creates a **draft** GitHub release \`${tag}\`. Publishing that draft${majorTag} ` +
    `stages the npm package, which must then be published by hand on npmjs.com.\n\n` +
    `Created by \`scripts/release.ts prepare\`. Changes: CHANGELOG.md, and the version in package.json and ` +
    `package-lock.json.\n\n` +
    `## Release notes\n\n${notes.trim() || '_No release notes._'}\n`
  );
}

function cleanupHint(branch: string, done: string[]): string {
  if (!done.includes('switch')) {
    return 'Nothing was changed.';
  }
  if (done.includes('push')) {
    return (
      `${branch} was pushed to origin. Finish by hand (see docs/DEVELOPMENT.md#releasing), or delete the remote ` +
      `branch on GitHub and run \`git switch main && git branch -D ${branch}\`.`
    );
  }
  return `Nothing was pushed. To start again: \`git switch --force main && git branch -D ${branch}\`.`;
}

export async function prepare(opts: Options, deps: PrepareDeps = {}): Promise<Runner> {
  const root = deps.root ?? ROOT;
  const runner = deps.runner ?? new Runner(Boolean(opts.dryRun));
  const interactive = deps.interactive ?? isInteractive();
  const ask = deps.ask ?? askTerminal;
  const print = deps.print ?? ((text: string) => process.stdout.write(text));
  const verifyFiles = deps.verify ?? verify;
  const explicit = validateInput(opts.releaseType, opts.version, opts.preid);

  // Preflight: fail before changing anything.
  checkTools(root, deps.which ?? onPath);
  await ensureGhLogin(runner, { interactive, yes: Boolean(opts.yes), ask, print });
  const repo = githubRepo(runner, root);
  checkGitState(runner, root);
  checkNoOpenReleasePr(runner, root);

  const workdir = fs.mkdtempSync(path.join(os.tmpdir(), 'kac-release-'));
  try {
    const bumped = bumpChangelog(runner, root, workdir, opts, repo);
    const version = parseReleaseVersion(bumped.version);
    if (explicit !== undefined && !version.equals(explicit)) {
      throw new ReleaseError(`kac produced version ${version.toString()}, expected ${explicit.toString()}`);
    }
    checkNewer(version, existingVersions(runner, root, repo));
    const branch = `${BRANCH_PREFIX}${version.toString()}`;
    if (runner.query(['git', 'ls-remote', '--heads', 'origin', branch], { cwd: root }).stdout.trim()) {
      throw new ReleaseError(`branch ${branch} already exists on origin`);
    }
    const body = path.join(workdir, 'pr-body.md');
    fs.writeFileSync(body, prBody(version, bumped.notes), 'utf8');

    const steps = [
      ['git', 'switch', '--create', branch, 'origin/main'],
      ['cp', bumped.changelog, 'CHANGELOG.md'],
      ['npm', 'version', version.toString(), '--no-git-tag-version', '--allow-same-version'],
    ];
    const checks = [
      ['npm', 'ci', '--legacy-peer-deps'],
      ['npm', 'run', 'all'],
      // dist/ is committed: fail if the rebuild changed it, as CI would.
      'git diff --exit-code --stat --ignore-space-at-eol --ignore-cr-at-eol -- dist/ :(exclude)*.js.map'.split(' '),
    ];
    const label = ['gh', 'label', 'create', LABEL, '--color', '0e8a16', '--force'];
    const pr = ['gh', 'pr', 'create', '--base', 'main', '--head', branch, '--label', LABEL, '--body-file', body];
    const publish = [
      ['git', 'add', 'CHANGELOG.md', 'package.json', 'package-lock.json'],
      ['git', 'commit', '--message', `chore: prepare release ${version.toString()}`],
      ['git', 'push', '--set-upstream', 'origin', branch],
      [...label, '--description', 'Release preparation pull request'],
      [...pr, '--title', `Release ${version.toString()}`],
      ['git', 'switch', 'main'],
    ];

    print(`Release:      ${version.toString()}${version.isPrerelease ? ' (prerelease)' : ''}\n`);
    print(`package.json: ${String(packageVersion(root))} -> ${version.toString()}\n`);
    print(`Branch:       ${branch}\n`);
    print(`Repository:   ${repo}\n\n`);
    const diff = runner.query(['git', 'diff', '--no-index', '--no-color', 'CHANGELOG.md', bumped.changelog], {
      cwd: root,
      check: false,
    });
    print(diff.stdout);
    print(`\nRelease notes:\n${bumped.notes.trim() || '(none)'}\n\n`);

    if (opts.dryRun) {
      print('Dry run: nothing was changed. These commands would run:\n');
      for (const cmd of [...steps, ...(opts.skipChecks ? [] : checks), ...publish]) {
        print(`  ${cmd.join(' ')}\n`);
        runner.planned.push(cmd);
      }
      print('  (plus `scripts/release.ts verify` after `npm version`)\n');
      return runner;
    }

    if (!opts.yes) {
      if (!interactive) {
        throw new ReleaseError('not running in a terminal; pass --yes to confirm, or --dry-run');
      }
      if (!isYes(await ask(`Create ${branch} and open the release pull request? [y/N] `))) {
        throw new ReleaseError('cancelled; nothing was changed');
      }
    }

    const done: string[] = [];
    try {
      for (const cmd of steps) {
        runner.act(cmd, { cwd: root });
        done.push(cmd[1]);
      }
      verifyFiles(version, root);
      if (!opts.skipChecks) {
        for (const cmd of checks) {
          runner.act(cmd, { cwd: root });
        }
      }
      for (const cmd of publish) {
        runner.act(cmd, { cwd: root });
        done.push(cmd[1]);
      }
    } catch (e) {
      if (e instanceof ReleaseError) {
        throw new ReleaseError(`${e.message}\n${cleanupHint(branch, done)}`, { cause: e });
      }
      throw e;
    }
    print(`\nRelease pull request opened for ${version.toString()}. Merging it creates the draft release.\n`);
    return runner;
  } finally {
    fs.rmSync(workdir, { recursive: true, force: true });
  }
}

// --- command line ----------------------------------------------------------------------------------------------------

const USAGE = `Usage:
  node scripts/release.ts prepare <type> [--preid alpha|beta|rc] [--version X.Y.Z[-(alpha|beta|rc).N]]
                                         [--dry-run] [--skip-checks] [--yes]
  node scripts/release.ts verify <version>
  node scripts/release.ts is-prerelease <version>
  node scripts/release.ts check-newer <version> --existing <file|->
  node scripts/release.ts parse-branch <ref>

Release types: ${RELEASE_TYPES.join(' | ')}

prepare options:
  --version      the release version, for manual releases
  --preid        prerelease identifier, for the pre* types (required for premajor, preminor, prepatch)
  --dry-run      show what would happen and change nothing
  --skip-checks  skip npm ci, npm run all and the dist/ check before pushing
  --yes          do not ask for confirmation
`;

function one(positionals: string[], name: string): string {
  if (positionals.length !== 2) {
    throw new UsageError(`${positionals[0]} takes exactly one argument: <${name}>`);
  }
  return positionals[1];
}

class UsageError extends Error {}

export async function main(argv: string[]): Promise<number> {
  try {
    const { values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        version: { type: 'string' },
        preid: { type: 'string' },
        'dry-run': { type: 'boolean' },
        'skip-checks': { type: 'boolean' },
        yes: { type: 'boolean' },
        existing: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
    });
    if (values.help) {
      process.stdout.write(USAGE);
      return 0;
    }
    switch (positionals[0]) {
      case 'prepare':
        await prepare({
          releaseType: one(positionals, 'type'),
          version: values.version,
          preid: values.preid,
          dryRun: values['dry-run'],
          skipChecks: values['skip-checks'],
          yes: values.yes,
        });
        break;
      case 'verify': {
        const version = parseReleaseVersion(one(positionals, 'version'));
        verify(version, ROOT);
        process.stdout.write(
          `package.json, package-lock.json and CHANGELOG.md describe release ${version.toString()}\n`
        );
        break;
      }
      case 'is-prerelease':
        process.stdout.write(`${parseReleaseVersion(one(positionals, 'version')).isPrerelease}\n`);
        break;
      case 'check-newer': {
        const version = parseReleaseVersion(one(positionals, 'version'));
        if (!values.existing) {
          throw new UsageError('check-newer needs --existing <file|->');
        }
        const text = fs.readFileSync(values.existing === '-' ? 0 : values.existing, 'utf8');
        checkNewer(version, text.split(/\r?\n/));
        break;
      }
      case 'parse-branch':
        process.stdout.write(`${parseBranch(one(positionals, 'ref')).toString()}\n`);
        break;
      default:
        throw new UsageError(positionals[0] ? `unknown command '${positionals[0]}'` : 'no command given');
    }
  } catch (e) {
    if (e instanceof ReleaseError) {
      process.stderr.write(`${inActions() ? '::error::' : 'error: '}${e.message}\n`);
      return 1;
    }
    const parseArgsError = e instanceof TypeError && 'code' in e && String(e.code).startsWith('ERR_PARSE_ARGS');
    if (e instanceof UsageError || parseArgsError) {
      process.stderr.write(`error: ${e.message}\n\n${USAGE}`);
      return 2;
    }
    throw e;
  }
  return 0;
}

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2));
}
