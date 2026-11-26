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
  mergePrereleases: boolean;
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
  mergePrereleases: false,
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

    expect(result.stderr).toMatch(/Option '--version' has an invalid value 'invalid'./);
    expect(result.stderr).toMatch(
      /The value must be one of: major, premajor, minor, preminor, patch, prepatch, prerelease, or release. Alternatively, it can be a valid semantic version number./
    );
  });

  it('errors when release-date is badly formatted', () => {
    const params = { ...DefaultParams };
    params.releaseDate = '12/21/2022';
    const result = runCommand(params);

    expect(result.isError).toBeTruthy();
    expect(getCliErrors(result)).toContain(
      "Option '--release-date' has an invalid value '12/21/2022'. The value must be a date in ISO 8601 format, e.g. '2022-03-03'."
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
      'The changelog does not contain any release notes in the [Unreleased] section, and fail-on-empty-release-notes is enabled.'
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

  it('uses the specfied semantic version', () => {
    const params = { ...DefaultParams };
    params.outputFile = 'changelog_1_output_cli.md';
    params.version = '1.0.1';
    const result = runCommand(params);

    expect(result.isError).toBeFalsy();

    const expectedFile = path.join(__dirname, 'changelog_1_expected_semver.md');
    const actualFile = path.join(__dirname, 'changelog_1_output_cli.md');
    expect(actualFile).toMatchFileSnapshot(expectedFile);
  });

  it('errors when version is omitted', () => {
    const params = { ...DefaultParams };
    params.version = null;
    params.outputFile = 'dummy.md';
    const result = runCommand(params);

    expect(result.isError).toBeTruthy();
    expect(result.stderr).toMatch(/Missing required argument: version/);
  });

  it('errors when version is release and the latest release is not a prerelease', () => {
    const params = { ...DefaultParams };
    params.version = 'release';
    params.outputFile = 'dummy.md';
    const result = runCommand(params);

    expect(result.isError).toBeTruthy();
    expect(result.exitCode).toBe(255);
    expect(getCliErrors(result)).toContain(
      "Version type 'release' can only be used when the latest release is a prerelease, but the latest version is 1.0.0. Use major, minor or patch, or specify an explicit version."
    );
  });

  it('removes the prerelease part when version is release and the latest release is a prerelease', async () => {
    const params = { ...DefaultParams };
    params.changelog = 'changelog_latest_prerelease.md';
    params.version = 'release';
    params.outputFile = 'changelog_release_output_cli.md';
    const result = runCommand(params);

    expect(result.isError).toBeFalsy();

    const output = await fs.readFile(path.join(__dirname, 'changelog_release_output_cli.md'), 'utf-8');
    expect(output).toMatch(/^## \[1\.1\.0\] - 2022-03-31$/m);
  });

  describe('when merging prereleases', () => {
    const MergeParams: typeof DefaultParams = {
      ...DefaultParams,
      changelog: 'changelog_prereleases_no_unreleased.md',
      version: 'release',
      releaseDate: '2022-02-05',
      mergePrereleases: true,
    };

    it('merges the prereleases into the new release when there is no [Unreleased] section', () => {
      const params = { ...MergeParams, outputFile: 'changelog_prereleases_no_unreleased_output_cli.md' };
      const result = runCommand(params);

      expect(result.isError).toBeFalsy();

      const expectedFile = path.join(__dirname, 'changelog_prereleases_no_unreleased_merged_expected.md');
      const actualFile = path.join(__dirname, 'changelog_prereleases_no_unreleased_output_cli.md');
      expect(actualFile).toMatchFileSnapshot(expectedFile);
    });

    it('merges the [Unreleased] section and the prereleases into the new release', () => {
      const params = {
        ...MergeParams,
        changelog: 'changelog_prereleases_with_unreleased.md',
        outputFile: 'changelog_prereleases_with_unreleased_output_cli.md',
      };
      const result = runCommand(params);

      expect(result.isError).toBeFalsy();

      const expectedFile = path.join(__dirname, 'changelog_prereleases_with_unreleased_merged_expected.md');
      const actualFile = path.join(__dirname, 'changelog_prereleases_with_unreleased_output_cli.md');
      expect(actualFile).toMatchFileSnapshot(expectedFile);
    });

    it('merges the prereleases into an explicit version', () => {
      const params = { ...MergeParams, version: '1.0.0', outputFile: 'changelog_prereleases_explicit_output_cli.md' };
      const result = runCommand(params);

      expect(result.isError).toBeFalsy();

      const expectedFile = path.join(__dirname, 'changelog_prereleases_no_unreleased_merged_expected.md');
      const actualFile = path.join(__dirname, 'changelog_prereleases_explicit_output_cli.md');
      expect(actualFile).toMatchFileSnapshot(expectedFile);
    });

    it.each(['prerelease', '1.0.0-beta.3'])('errors when the next version (%s) is a prerelease', (version) => {
      const params = { ...MergeParams, version, outputFile: 'dummy.md' };
      const result = runCommand(params);

      expect(result.isError).toBeTruthy();
      expect(getCliErrors(result)).toContain(
        'Prereleases can only be merged into a full release, but the next version is 1.0.0-beta.3. Use release, major, minor or patch, or specify an explicit non-prerelease version.'
      );
    });

    it('errors when the next version is a prerelease even if there are no prereleases to merge', () => {
      const params = { ...MergeParams, changelog: 'good_changelog.md', version: 'preminor', outputFile: 'dummy.md' };
      const result = runCommand(params);

      expect(result.isError).toBeTruthy();
      expect(getCliErrors(result)[0]).toMatch(/^Prereleases can only be merged into a full release/);
    });

    it('behaves as normal when the latest release is not a prerelease', () => {
      const params = { ...DefaultParams, mergePrereleases: true, outputFile: 'changelog_1_merge_output_cli.md' };
      const result = runCommand(params);

      expect(result.isError).toBeFalsy();

      const expectedFile = path.join(__dirname, 'changelog_1_expected.md');
      const actualFile = path.join(__dirname, 'changelog_1_merge_output_cli.md');
      expect(actualFile).toMatchFileSnapshot(expectedFile);
    });

    it('keeps an empty [Unreleased] section above the merged release', async () => {
      const params = {
        ...MergeParams,
        keepUnreleasedSection: true,
        outputFile: 'changelog_prereleases_keep_unreleased_output_cli.md',
      };
      const result = runCommand(params);

      expect(result.isError).toBeFalsy();

      const actual = await fs.readFile(
        path.join(__dirname, 'changelog_prereleases_keep_unreleased_output_cli.md'),
        'utf-8'
      );
      expect(actual).toContain('## [Unreleased]\n\n## [1.0.0] - 2022-02-05\n\n### Added\n\n- Final polish\n');
      expect(actual).not.toContain('beta.2');
    });

    it('errors when the merged release notes are empty and configured to check', () => {
      const params = {
        ...MergeParams,
        changelog: 'changelog_empty_prereleases.md',
        failOnEmptyReleaseNotes: true,
        outputFile: 'dummy.md',
      };
      const result = runCommand(params);

      expect(result.isError).toBeTruthy();
      expect(getCliErrors(result)).toContain(
        'The release notes for 1.0.0 are empty after merging the prereleases, and fail-on-empty-release-notes is enabled.'
      );
    });

    it('suggests merging when there is no [Unreleased] section and merging is not enabled', () => {
      const params = { ...MergeParams, mergePrereleases: false, outputFile: 'dummy.md' };
      const result = runCommand(params);

      expect(result.isError).toBeTruthy();
      expect(result.stderr).toMatch(
        /To release the prereleases without an \[Unreleased\] section, enable merge-prereleases/
      );
    });

    it("doesn't suggest merging when the latest release is not a prerelease", () => {
      const params = { ...DefaultParams, changelog: 'changelog_no_unreleased.md', outputFile: 'dummy.md' };
      const result = runCommand(params);

      expect(result.isError).toBeTruthy();
      expect(result.stderr).toMatch(/must contain an \[Unreleased\] section/);
      expect(result.stderr).not.toMatch(/merge-prereleases/);
    });
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
  if (params.mergePrereleases) {
    argv.push('--merge-prereleases');
  }
  if (params.githubRepo !== null) {
    argv.push('--github-repo');
    argv.push(params.githubRepo);
  }

  return invokeCommandLine(path.join(__dirname, '../cli.js'), __dirname, argv, env);
}
