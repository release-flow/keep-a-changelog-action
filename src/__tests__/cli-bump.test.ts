import * as path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { globby } from 'globby';

import './jest-file-diff.js';

import { invokeCommandLine, getCliErrors, CliResult } from './test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.join(__dirname, '../..');

interface CliParams {
  changelog: string | null;
  version: string | null;
  preid: string | null;
  releaseDate: string | null;
  tagPrefix: string | null;
  outputFile: string | null;
  githubRepo: string | null;
  keepUnreleasedSection: boolean;
  failOnEmptyReleaseNotes: boolean;
}

const DefaultParams: CliParams = {
  changelog: 'good_changelog.md',
  version: 'minor',
  preid: null,
  releaseDate: '2022-03-31',
  tagPrefix: 'v',
  outputFile: 'tmp_changelog.md',
  githubRepo: 'test/dummy',
  keepUnreleasedSection: false,
  failOnEmptyReleaseNotes: false,
};

describe('bump CLI subcommand', () => {
  beforeAll(async () => {
    // Globby requires Posix file paths i.e. with forward slashes
    const posixRoot = root.replace(/\\/g, '/');
    const filespec = path.posix.join(posixRoot, 'src/__tests__/*.md');

    const mdFiles = await globby(filespec);

    for (const file of mdFiles) {
      await fs.copyFile(file, path.join(__dirname, path.basename(file)));
    }
  });

  it('errors when version is invalid', () => {
    const params = { ...DefaultParams };
    params.version = 'invalid';
    const result = runCommand(params);

    expect(result.isError).toBeTruthy();

    expect(result.stderr).toMatch(/Invalid values:/);
    expect(result.stderr).toMatch(
      /Argument: version, Given: "invalid", Choices: "major", "premajor", "minor", "preminor", "patch", "prepatch", "prerelease"/
    );
  });

  it('errors when release-date is badly formatted', () => {
    const params = { ...DefaultParams };
    params.releaseDate = '12/21/2022';
    const result = runCommand(params);

    expect(result.isError).toBeTruthy();
    expect(getCliErrors(result)).toContain(
      "Input 'release-date' has an invalid value '12/21/2022'. The value must be a date in ISO 8601 format, e.g. '2022-03-03'"
    );
  });

  it('errors when the changelog has no [Unreleased] section', () => {
    const params = { ...DefaultParams };
    params.changelog = 'changelog_no_unreleased.md';
    params.outputFile = 'changelog_no_unreleased_output.md';
    const result = runCommand(params);

    expect(result.isError).toBeTruthy();
  });

  it('errors when the changelog has an empty [Unreleased] section when configured to check', () => {
    const params = { ...DefaultParams };
    params.changelog = 'changelog_empty_unreleased.md';
    params.outputFile = 'dummy.md';
    params.failOnEmptyReleaseNotes = true;
    const result = runCommand(params);

    expect(result.isError).toBeTruthy();
    expect(getCliErrors(result)).toContain(
      'The changelog does not contain any release notes in the [Unreleased] section, and the action is configured to fail if this is empty.'
    );
  });

  it("doesn't error when the changelog has a non-empty [Unreleased] section when configured to check", () => {
    const params = { ...DefaultParams };
    params.changelog = 'good_changelog.md';
    params.outputFile = 'dummy.md';
    params.failOnEmptyReleaseNotes = true;
    const result = runCommand(params);

    expect(result.isError).toBeFalsy();
  });

  it('produces a correctly updated changelog', () => {
    const params = { ...DefaultParams };
    params.outputFile = 'changelog_1_output_cli.md';
    const result = runCommand(params);

    expect(result.isError).toBeFalsy();

    const expectedFile = path.join(__dirname, 'changelog_1_expected.md');
    const actualFile = path.join(__dirname, 'changelog_1_output_cli.md');
    expect(actualFile).toMatchFileSnapshot(expectedFile);
  });

  it('produces a correctly updated changelog without links when no repo is specified', () => {
    const params = { ...DefaultParams };
    params.outputFile = 'changelog_output_cli_norepo.md';
    params.githubRepo = null;
    const result = runCommand(params);

    expect(result.isError).toBeFalsy();

    const expectedFile = path.join(__dirname, 'changelog_1_expected_norepo.md');
    const actualFile = path.join(__dirname, 'changelog_output_cli_norepo.md');
    expect(actualFile).toMatchFileSnapshot(expectedFile);
  });

  it('correctly updates a changelog with no releases (1)', () => {
    const params = { ...DefaultParams };
    params.changelog = 'initial_changelog_1.md';
    params.outputFile = 'initial_changelog_2_output_cli.md';
    const result = runCommand(params);

    expect(result.isError).toBeFalsy();

    const expectedFile = path.join(__dirname, 'initial_changelog_expected.md');
    const actualFile = path.join(__dirname, 'initial_changelog_2_output_cli.md');
    expect(actualFile).toMatchFileSnapshot(expectedFile);
  });

  it('correctly updates a changelog with no releases or definitions (2)', () => {
    const params = { ...DefaultParams };
    params.changelog = 'initial_changelog_2.md';
    params.outputFile = 'initial_changelog_2_output_cli.md';
    const result = runCommand(params);

    expect(result.isError).toBeFalsy();

    const expectedFile = path.join(__dirname, 'initial_changelog_expected.md');
    const actualFile = path.join(__dirname, 'initial_changelog_2_output_cli.md');
    expect(actualFile).toMatchFileSnapshot(expectedFile);
  });

  it('correctly updates a changelog with an empty tag prefix', () => {
    const params = { ...DefaultParams };
    params.outputFile = 'changelog_notagprefix_output_cli.md';
    params.tagPrefix = '';
    const result = runCommand(params);

    expect(result.isError).toBeFalsy();

    const expectedFile = path.join(__dirname, 'changelog_notagprefix_expected.md');
    const actualFile = path.join(__dirname, 'changelog_notagprefix_output_cli.md');
    expect(actualFile).toMatchFileSnapshot(expectedFile);
  });

  it('keeps the unreleased section', () => {
    const params = { ...DefaultParams };
    params.outputFile = 'changelog_1_keep_unreleased_output_cli.md';
    params.keepUnreleasedSection = true;
    const result = runCommand(params);

    expect(result.isError).toBeFalsy();

    const expectedFile = path.join(__dirname, 'changelog_1_keep_unreleased_expected.md');
    const actualFile = path.join(__dirname, 'changelog_1_keep_unreleased_output_cli.md');
    expect(actualFile).toMatchFileSnapshot(expectedFile);
  });
});

function runCommand(params: CliParams): CliResult {
  const env: NodeJS.ProcessEnv = {};

  const argv: string[] = ['bump'];

  if (params.changelog !== null) {
    argv.push('--changelog');
    argv.push(params.changelog);
  }

  if (params.version !== null) {
    argv.push('--version');
    argv.push(params.version);
  }

  if (params.preid !== null) {
    argv.push('--preid');
    argv.push(params.preid);
  }

  if (params.releaseDate !== null) {
    argv.push('--release-date');
    argv.push(params.releaseDate);
  }

  if (params.tagPrefix !== null) {
    argv.push('--tag-prefix');
    argv.push(params.tagPrefix);
  }

  if (params.outputFile !== null) {
    argv.push('--output-file');
    argv.push(params.outputFile);
  }

  if (params.keepUnreleasedSection) {
    argv.push('--keep-unreleased-section');
  }
  if (params.failOnEmptyReleaseNotes) {
    argv.push('--fail-on-empty-release-notes');
  }
  if (params.githubRepo !== null) {
    argv.push('--github-repo');
    argv.push(params.githubRepo);
  }

  return invokeCommandLine(path.join(__dirname, '../cli.js'), __dirname, argv, env);
}
