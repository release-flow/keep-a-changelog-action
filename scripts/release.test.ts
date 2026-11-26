// Release tooling (scripts/release.ts): version rules, file checks, and `prepare` with every command faked.
// Run with `node --test scripts/`.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, mock, test } from 'node:test';

import {
  type CommandResult,
  type Options,
  type PrepareDeps,
  ReleaseError,
  Runner,
  Version,
  changelogVersions,
  checkNewer,
  ensureGhLogin,
  packageVersion,
  parseBranch,
  parseReleaseVersion,
  prBody,
  prepare,
  validateInput,
  verify,
} from './release.ts';

const V = (text: string) => Version.parse(text);

const UNRELEASED_CHANGELOG = `# Changelog

## [Unreleased]

### Added

- Something new

## [0.1.0] - 2026-11-01

### Added

- First release
`;

const RELEASED_CHANGELOG = UNRELEASED_CHANGELOG.replace(
  '## [Unreleased]\n',
  '## [Unreleased]\n\n## [0.2.0-rc.1] - 2026-11-25\n'
);

const BUMPED = (v: string) =>
  UNRELEASED_CHANGELOG.replace('## [Unreleased]\n', `## [Unreleased]\n\n## [${v}] - 2026-11-25\n`);

// Silence the warnings checkNewer prints for unparseable versions.
mock.method(process.stderr, 'write', () => true);

// --- versions --------------------------------------------------------------------------------------------------------

describe('Version', () => {
  const ordered: [string, string][] = [
    ['1.0.0', '1.0.1'],
    ['1.0.9', '1.1.0'],
    ['1.9.9', '2.0.0'],
    ['1.0.0-rc.1', '1.0.0'],
    ['1.0.0-alpha.1', '1.0.0-beta.0'],
    ['1.0.0-beta.9', '1.0.0-rc.0'],
    ['1.0.0-rc.2', '1.0.0-rc.10'], // numeric, not lexical
    ['1.0.0-1', '1.0.0-alpha'], // numeric identifiers sort before alphanumeric ones
    ['1.0.0-alpha', '1.0.0-alpha.1'], // fewer identifiers sort first
    ['v0.9.0', '0.10.0'],
  ];
  for (const [lower, higher] of ordered) {
    test(`${lower} < ${higher}`, () => {
      assert.ok(V(lower).compare(V(higher)) < 0);
      assert.ok(V(higher).compare(V(lower)) > 0);
    });
  }

  test('build metadata is ignored when reading', () => {
    assert.ok(V('1.2.3+build.5').equals(V('1.2.3')));
  });

  test('a floating major tag is not a version', () => {
    assert.throws(() => V('v3'), ReleaseError);
  });
});

describe('parseReleaseVersion', () => {
  for (const text of ['1.2.3', '0.1.0', '1.2.3-alpha.0', '1.2.3-beta.4', '10.20.30-rc.12']) {
    test(`accepts ${text}`, () => {
      assert.equal(parseReleaseVersion(text).toString(), text);
    });
  }
  for (const text of [
    '1.2',
    'v1.2.3',
    '01.2.3',
    '1.2.3-0',
    '1.2.3-rc',
    '1.2.3-rc.01',
    '1.2.3-dev.1',
    '1.2.3+b1',
    '1.2.3 x',
    '',
  ]) {
    test(`rejects '${text}'`, () => {
      assert.throws(() => parseReleaseVersion(text), ReleaseError);
    });
  }
});

describe('checkNewer', () => {
  test('accepts a higher version', () => {
    checkNewer(V('1.3.0'), ['v1.2.0', '1.2.1-rc.0', '', 'not-a-version', 'v1', 'v1.3.0-rc.1']);
  });

  test('accepts the first release', () => {
    checkNewer(V('0.1.0'), []);
  });

  for (const version of ['1.2.0', '1.1.9', '1.2.0-rc.5']) {
    test(`rejects ${version}`, () => {
      assert.throws(() => checkNewer(V(version), ['v1.0.0', 'v1.2.0', 'v1.1.0']), /not greater/);
    });
  }
});

test('parseBranch', () => {
  assert.ok(parseBranch('chore/release-1.2.0-rc.1').equals(V('1.2.0-rc.1')));
  for (const ref of ['chore/release/1.2.0', 'autorelease/1.2.0', 'chore/release-1.2', 'chore/release-1.2.0-0']) {
    assert.throws(() => parseBranch(ref), ReleaseError, ref);
  }
});

test('changelogVersions skips Unreleased', () => {
  assert.deepEqual(
    changelogVersions(RELEASED_CHANGELOG).map((v) => v.toString()),
    ['0.2.0-rc.1', '0.1.0']
  );
});

test('prBody mentions the major tag only for stable releases', () => {
  assert.match(prBody(V('2.0.0'), '- x'), /moves the `v2` tag/);
  assert.doesNotMatch(prBody(V('2.0.0-rc.0'), '- x'), /moves the/);
  assert.match(prBody(V('2.0.0'), ''), /_No release notes._/);
});

// --- input validation ------------------------------------------------------------------------------------------------

describe('validateInput', () => {
  test('manual requires --version', () => {
    assert.throws(() => validateInput('manual'), /need --version/);
    assert.ok(validateInput('manual', '2.0.0')?.equals(V('2.0.0')));
  });

  test('--version only applies to manual', () => {
    assert.throws(() => validateInput('minor', '2.0.0'), /only applies to manual/);
  });

  test('a manual version must be a release version', () => {
    assert.throws(() => validateInput('manual', '1.0.0-0'), ReleaseError);
    assert.throws(() => validateInput('manual', '4.0.0-beta'), ReleaseError);
  });

  test('preid rules', () => {
    assert.equal(validateInput('preminor', undefined, 'rc'), undefined);
    assert.equal(validateInput('prerelease'), undefined);
    assert.throws(() => validateInput('premajor'), /needs --preid/);
    assert.throws(() => validateInput('patch', undefined, 'rc'), /only applies to/);
    assert.throws(() => validateInput('prepatch', undefined, 'next'), /must be one of/);
  });

  test('unknown type', () => {
    assert.throws(() => validateInput('huge'), /unknown release type/);
  });
});

// --- verify ----------------------------------------------------------------------------------------------------------

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'release-test-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function writeProject(
  root: string,
  opts: { version: string; changelog: string; locked?: string; lockedRoot?: string }
): void {
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'kac', version: opts.version }));
  const lock = {
    name: 'kac',
    version: opts.locked ?? opts.version,
    packages: { '': { name: 'kac', version: opts.lockedRoot ?? opts.locked ?? opts.version } },
  };
  fs.writeFileSync(path.join(root, 'package-lock.json'), JSON.stringify(lock));
  fs.writeFileSync(path.join(root, 'CHANGELOG.md'), opts.changelog);
}

describe('verify', () => {
  test('passes when everything agrees', () => {
    writeProject(tmp, { version: '0.2.0-rc.1', changelog: RELEASED_CHANGELOG });
    verify(V('0.2.0-rc.1'), tmp);
  });

  const cases: [string, Parameters<typeof writeProject>[1], RegExp][] = [
    ['package.json', { version: '0.2.0', changelog: RELEASED_CHANGELOG }, /package\.json has version 0\.2\.0/],
    [
      'lockfile',
      { version: '0.2.0-rc.1', locked: '0.1.0', changelog: RELEASED_CHANGELOG },
      /package-lock\.json has version 0\.1\.0/,
    ],
    [
      'lockfile root package',
      { version: '0.2.0-rc.1', lockedRoot: '0.1.0', changelog: RELEASED_CHANGELOG },
      /package-lock\.json has packages\[""\]\.version 0\.1\.0/,
    ],
    [
      'changelog',
      { version: '0.2.0-rc.1', changelog: UNRELEASED_CHANGELOG },
      /latest release in CHANGELOG\.md is 0\.1\.0/,
    ],
    ['no releases', { version: '0.2.0-rc.1', changelog: '# Changelog\n\n## [Unreleased]\n' }, /no release sections/],
  ];
  for (const [name, project, problem] of cases) {
    test(`reports a mismatched ${name}`, () => {
      writeProject(tmp, project);
      assert.throws(() => verify(V('0.2.0-rc.1'), tmp), problem);
    });
  }
});

// --- gh login --------------------------------------------------------------------------------------------------------

type Respond = (cmd: string[]) => [number, string];

/** Answers every command from `respond` and records what ran. Nothing reaches a real process. */
class FakeRunner extends Runner {
  readonly respond: Respond;
  readonly queries: string[][] = [];
  readonly acted: string[][] = [];
  readonly interactiveCalls: string[][] = [];

  constructor(respond: Respond, dryRun = false) {
    super(dryRun);
    this.respond = respond;
  }

  override query(cmd: readonly string[], opts: { cwd: string; check?: boolean }): CommandResult {
    this.queries.push([...cmd]);
    const [status, stdout] = this.respond([...cmd]);
    if ((opts.check ?? true) && status !== 0) {
      throw new ReleaseError(`\`${cmd.join(' ')}\` failed`);
    }
    return { status, stdout, stderr: '' };
  }

  override act(cmd: readonly string[]): void {
    this.planned.push([...cmd]);
    if (!this.dryRun) {
      this.acted.push([...cmd]);
    }
  }

  override interactive(cmd: readonly string[]): number {
    this.interactiveCalls.push([...cmd]);
    return 0;
  }
}

function ghStatus(results: number[]): Respond {
  return (cmd) => {
    assert.deepEqual(cmd.slice(0, 3), ['gh', 'auth', 'status']);
    return [results.shift() ?? 1, ''];
  };
}

const neverAsk = async (prompt: string): Promise<string> => {
  throw new Error(`unexpected prompt: ${prompt}`);
};
const quiet = () => {};

describe('ensureGhLogin', () => {
  test('continues when logged in', async () => {
    const runner = new FakeRunner(ghStatus([0]));
    await ensureGhLogin(runner, { interactive: true, yes: false, ask: neverAsk });
    assert.deepEqual(runner.interactiveCalls, []);
  });

  test('logs in when the operator agrees', async () => {
    const runner = new FakeRunner(ghStatus([1, 0]));
    await ensureGhLogin(runner, { interactive: true, yes: false, ask: async () => 'y', print: quiet });
    assert.deepEqual(runner.interactiveCalls, [['gh', 'auth', 'login', '--hostname', 'github.com', '--web']]);
  });

  test('aborts when the login still fails', async () => {
    const runner = new FakeRunner(ghStatus([1, 1]));
    await assert.rejects(
      ensureGhLogin(runner, { interactive: true, yes: false, ask: async () => 'yes', print: quiet }),
      /still not logged in/
    );
  });

  test('aborts when the operator declines', async () => {
    const runner = new FakeRunner(ghStatus([1]));
    await assert.rejects(
      ensureGhLogin(runner, { interactive: true, yes: false, ask: async () => '', print: quiet }),
      /gh auth login/
    );
    assert.deepEqual(runner.interactiveCalls, []);
  });

  for (const [interactive, yes] of [
    [false, false],
    [true, true],
    [false, true],
  ]) {
    test(`aborts without prompting (interactive=${interactive}, yes=${yes})`, async () => {
      const runner = new FakeRunner(ghStatus([1]));
      await assert.rejects(ensureGhLogin(runner, { interactive, yes, ask: neverAsk }), /gh auth login/);
      assert.deepEqual(runner.interactiveCalls, []);
    });
  }
});

// --- prepare ---------------------------------------------------------------------------------------------------------

/** A release-ready checkout: package.json at 0.1.0, unreleased changes, a (fake) dist/cli. */
function makeProject(root: string): void {
  writeProject(root, { version: '0.1.0', changelog: UNRELEASED_CHANGELOG });
  fs.mkdirSync(path.join(root, 'dist', 'cli'), { recursive: true });
  fs.writeFileSync(path.join(root, 'dist', 'cli', 'index.js'), '');
}

interface GitHubState {
  computed?: string;
  permission?: string;
  dirty?: boolean;
  branch?: string;
  tags?: string;
  releases?: string;
  openPrs?: string;
  remoteBranch?: string;
}

/** Fake answers for every read-only command `prepare` runs. */
function github(state: GitHubState = {}): Respond {
  const {
    computed = '0.2.0',
    permission = 'ADMIN',
    dirty = false,
    branch = 'main',
    tags = 'v0\nv0.1.0\n',
    releases = 'v0.1.0\n',
    openPrs = '[]',
    remoteBranch = '',
  } = state;
  return (cmd) => {
    const [tool, a, b] = cmd;
    if (tool === process.execPath && a.endsWith(path.join('dist', 'cli', 'index.js'))) {
      if (b === 'bump') {
        fs.writeFileSync(cmd[cmd.indexOf('--changelog') + 1], BUMPED(computed));
        return [0, ''];
      }
      if (b === 'query') {
        return [0, JSON.stringify({ version: computed, 'release-notes': '### Added\n\n- Something new\n' })];
      }
    }
    const key = `${tool} ${a} ${b ?? ''}`;
    if (key.startsWith('gh auth status')) return [0, ''];
    if (key.startsWith('gh repo view')) {
      return [0, JSON.stringify({ nameWithOwner: 'example/kac', viewerPermission: permission })];
    }
    if (key.startsWith('gh pr list')) return [0, openPrs];
    if (key.startsWith('gh api')) return [0, releases];
    if (key.startsWith('git status')) return [0, dirty ? ' M README.md\n' : ''];
    if (key.startsWith('git fetch')) return [0, ''];
    if (key.startsWith('git rev-parse --abbrev-ref')) return [0, `${branch}\n`];
    if (key.startsWith('git rev-parse')) return [0, 'abc123\n'];
    if (key.startsWith('git ls-remote --tags')) {
      // The output of `git ls-remote --tags --refs`: one `<sha>\trefs/tags/<tag>` line per tag.
      const lines = tags.split('\n').filter(Boolean);
      return [0, lines.map((tag) => `abc123\trefs/tags/${tag}\n`).join('')];
    }
    if (key.startsWith('git ls-remote --heads')) return [0, remoteBranch];
    if (key.startsWith('git diff --no-index')) return [1, '+## [x]\n'];
    throw new Error(`unexpected command: ${cmd.join(' ')}`);
  };
}

function run(opts: Options, runner: FakeRunner, deps: PrepareDeps = {}): { promise: Promise<Runner>; out: string[] } {
  const out: string[] = [];
  const promise = prepare(opts, {
    root: tmp,
    runner,
    interactive: false,
    which: () => true,
    print: (text) => out.push(text),
    ...deps,
  });
  return { promise, out };
}

describe('prepare', () => {
  beforeEach(() => makeProject(tmp));

  test('a dry run changes nothing', async () => {
    const runner = new FakeRunner(github(), true);
    const { promise, out } = run({ releaseType: 'minor', dryRun: true }, runner);
    await promise;

    assert.deepEqual(runner.acted, []);
    assert.equal(fs.readFileSync(path.join(tmp, 'CHANGELOG.md'), 'utf8'), UNRELEASED_CHANGELOG);
    assert.equal(packageVersion(tmp), '0.1.0');
    for (const cmd of runner.queries) {
      const pair = cmd.slice(0, 2).join(' ');
      assert.ok(!['git switch', 'git commit', 'git push', 'npm version'].includes(pair), cmd.join(' '));
    }
    const planned = runner.planned.map((c) => c.join(' '));
    assert.ok(planned.includes('git switch --create chore/release-0.2.0 origin/main'));
    assert.ok(planned.includes('npm version 0.2.0 --no-git-tag-version --allow-same-version'));
    assert.ok(planned.includes('npm run all'));
    assert.ok(planned.some((p) => p.startsWith('gh pr create --base main --head chore/release-0.2.0')));
    assert.ok(planned.some((p) => p.endsWith('--title Release 0.2.0')));
    const text = out.join('');
    assert.match(text, /package\.json: 0\.1\.0 -> 0\.2\.0/);
    assert.match(text, /Dry run: nothing was changed/);
  });

  test('--skip-checks omits the checks', async () => {
    const runner = new FakeRunner(github(), true);
    await run({ releaseType: 'minor', dryRun: true, skipChecks: true }, runner).promise;
    assert.ok(!runner.planned.some((c) => c[0] === 'npm' && c[1] !== 'version'));
  });

  test('runs the steps in order', async () => {
    const runner = new FakeRunner(github({ computed: '0.2.0-rc.0' }));
    const verifyCalls: string[] = [];
    const fakeVerify = (version: Version) => {
      // verify runs once the files are updated
      assert.deepEqual(runner.acted.at(-1)?.slice(0, 2), ['npm', 'version']);
      verifyCalls.push(version.toString());
    };
    await run({ releaseType: 'preminor', preid: 'rc', yes: true }, runner, { verify: fakeVerify }).promise;
    assert.deepEqual(verifyCalls, ['0.2.0-rc.0']);
    assert.deepEqual(
      runner.acted.map((c) => c.slice(0, 2).join(' ')),
      [
        'git switch',
        `cp ${runner.acted[1][1]}`,
        'npm version',
        'npm ci',
        'npm run',
        'git diff',
        'git add',
        'git commit',
        'git push',
        'gh label',
        'gh pr',
        'git switch',
      ]
    );
    assert.deepEqual(runner.acted[2], ['npm', 'version', '0.2.0-rc.0', '--no-git-tag-version', '--allow-same-version']);
  });

  test('needs confirmation outside a terminal', async () => {
    const runner = new FakeRunner(github());
    await assert.rejects(run({ releaseType: 'minor' }, runner).promise, /--yes/);
    assert.deepEqual(runner.acted, []);
  });

  test('can be cancelled', async () => {
    const runner = new FakeRunner(github());
    await assert.rejects(
      run({ releaseType: 'minor' }, runner, { interactive: true, ask: async () => 'n' }).promise,
      /cancelled/
    );
    assert.deepEqual(runner.acted, []);
  });

  const refusals: [GitHubState, RegExp][] = [
    [{ permission: 'WRITE' }, /admin or maintain/],
    [{ dirty: true }, /uncommitted/],
    [{ branch: 'feature/x' }, /current branch is feature\/x/],
    [{ openPrs: '[{"url": "https://github.com/example/kac/pull/7"}]' }, /already open/],
    [{ tags: 'v0.1.0\nv0.2.0\n' }, /not greater than the current release 0\.2\.0/],
    [{ releases: 'v0.3.0-rc.0\n' }, /not greater than the current release 0\.3\.0-rc\.0/], // a draft
    [{ remoteBranch: 'abc\trefs/heads/chore/release-0.2.0\n' }, /already exists on origin/],
    [{ computed: '0.2.0-0' }, /not a valid release version/],
  ];
  for (const [state, problem] of refusals) {
    test(`refuses: ${JSON.stringify(state)}`, async () => {
      const runner = new FakeRunner(github(state), true);
      await assert.rejects(run({ releaseType: 'minor', dryRun: true }, runner).promise, problem);
      assert.deepEqual(runner.acted, []);
    });
  }

  test('refuses when tools are missing', async () => {
    const runner = new FakeRunner(github(), true);
    await assert.rejects(
      run({ releaseType: 'minor', dryRun: true }, runner, { which: (t) => t !== 'gh' }).promise,
      /missing tools: gh/
    );
  });

  test('refuses a manual version lower than the current one', async () => {
    const runner = new FakeRunner(github({ computed: '0.0.9' }), true);
    await assert.rejects(run({ releaseType: 'manual', version: '0.0.9', dryRun: true }, runner).promise, /not greater/);
  });

  test('explains the cleanup after a failure once pushed', async () => {
    class FailingPr extends FakeRunner {
      override act(cmd: readonly string[]): void {
        if (cmd.slice(0, 3).join(' ') === 'gh pr create') {
          throw new ReleaseError('`gh pr create` failed');
        }
        super.act(cmd);
      }
    }
    const runner = new FailingPr(github());
    await assert.rejects(
      run({ releaseType: 'minor', skipChecks: true, yes: true }, runner, { verify: () => {} }).promise,
      /was pushed to origin/
    );
  });
});
