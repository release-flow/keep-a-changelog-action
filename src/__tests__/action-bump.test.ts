import * as path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { globby } from 'globby';

import './jest-file-diff.js';

import { invokeActionScript, getAllErrors, ActionResult } from './test-utils.js';

// eslint-disable-next-line no-underscore-dangle
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line no-underscore-dangle
const __dirname = path.dirname(__filename);

const root = path.join(__dirname, '../..');

interface ActionParams {
  changelog: string | null;
  releaseType: string | null;
  preid: string | null;
  releaseDate: string | null;
  tagPrefix: string | null;
  outputFile: string | null;
  githubRepo: string | null;
  keepUnreleasedSection: boolean;
  failOnEmptyReleaseNotes: boolean;
}

const DefaultParams: ActionParams = {
  changelog: 'good_changelog.md',
  releaseType: 'minor',
  preid: null,
  releaseDate: '2022-03-31',
  tagPrefix: 'v',
  outputFile: 'tmp_changelog.md',
  githubRepo: 'test/dummy',
  keepUnreleasedSection: false,
  failOnEmptyReleaseNotes: false,
};

describe('bump subcommand', () => {
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
    params.releaseType = 'invalid';
    const result = runAction(params);

    expect(result.isError).toBeTruthy();
    expect(getAllErrors(result)).toContain(
      "Input 'version' has an invalid value 'invalid'. The value must be one of: major, premajor, minor, preminor, patch, prepatch, or prerelease"
    );
  });

  it('errors when release-date is badly formatted', () => {
    const params = { ...DefaultParams };
    params.releaseDate = '12/21/2022';
    const result = runAction(params);

    expect(result.isError).toBeTruthy();
    expect(getAllErrors(result)).toContain(
      "Input 'release-date' has an invalid value '12/21/2022'. The value must be a date in ISO 8601 format, e.g. '2022-03-03'"
    );
  });

  it('errors when the changelog has no [Unreleased] section', () => {
    const params = { ...DefaultParams };
    params.changelog = 'changelog_no_unreleased.md';
    params.outputFile = 'changelog_no_unreleased_output.md';
    const result = runAction(params);

    expect(result.isError).toBeTruthy();
  });

  it('errors when the changelog has an empty [Unreleased] section when configured to check', () => {
    const params = { ...DefaultParams };
    params.changelog = 'changelog_empty_unreleased.md';
    params.outputFile = 'dummy.md';
    params.failOnEmptyReleaseNotes = true;
    const result = runAction(params);

    expect(result.isError).toBeTruthy();
    expect(getAllErrors(result)).toContain(
      'The changelog does not contain any release notes in the [Unreleased] section, and the action is configured to fail if this is empty.'
    );
  });

  it("doesn't error when the changelog has a non-empty [Unreleased] section when configured to check", () => {
    const params = { ...DefaultParams };
    params.changelog = 'good_changelog.md';
    params.outputFile = 'dummy.md';
    params.failOnEmptyReleaseNotes = true;
    const result = runAction(params);

    expect(result.isError).toBeFalsy();
  });

  it('produces a correctly updated changelog', () => {
    const params = { ...DefaultParams };
    params.outputFile = 'changelog_1_output.md';
    const result = runAction(params);

    expect(result.isError).toBeFalsy();

    const expectedFile = path.join(__dirname, 'changelog_1_expected.md');
    const actualFile = path.join(__dirname, 'changelog_1_output.md');
    expect(actualFile).toMatchFileSnapshot(expectedFile);
  });

  it('correctly updates a changelog with no releases (1)', () => {
    const params = { ...DefaultParams };
    params.changelog = 'initial_changelog_1.md';
    params.outputFile = 'initial_changelog_1_output.md';
    const result = runAction(params);

    expect(result.isError).toBeFalsy();

    const expectedFile = path.join(__dirname, 'initial_changelog_expected.md');
    const actualFile = path.join(__dirname, 'initial_changelog_1_output.md');
    expect(actualFile).toMatchFileSnapshot(expectedFile);
  });

  it('correctly updates a changelog with no releases or definitions (2)', () => {
    const params = { ...DefaultParams };
    params.changelog = 'initial_changelog_2.md';
    params.outputFile = 'initial_changelog_2_output.md';
    const result = runAction(params);

    expect(result.isError).toBeFalsy();

    const expectedFile = path.join(__dirname, 'initial_changelog_expected.md');
    const actualFile = path.join(__dirname, 'initial_changelog_2_output.md');
    expect(actualFile).toMatchFileSnapshot(expectedFile);
  });

  it('correctly updates a changelog with an empty tag prefix', () => {
    const params = { ...DefaultParams };
    params.outputFile = 'changelog_notagprefix_output.md';
    params.tagPrefix = '';
    const result = runAction(params);

    expect(result.isError).toBeFalsy();

    const expectedFile = path.join(__dirname, 'changelog_notagprefix_expected.md');
    const actualFile = path.join(__dirname, 'changelog_notagprefix_output.md');
    expect(actualFile).toMatchFileSnapshot(expectedFile);
  });

  it('keeps the unreleased section', () => {
    const params = { ...DefaultParams };
    params.outputFile = 'changelog_1_keep_unreleased_output.md';
    params.keepUnreleasedSection = true;
    const result = runAction(params);

    expect(result.isError).toBeFalsy();

    const expectedFile = path.join(__dirname, 'changelog_1_keep_unreleased_expected.md');
    const actualFile = path.join(__dirname, 'changelog_1_keep_unreleased_output.md');
    expect(actualFile).toMatchFileSnapshot(expectedFile);
  });

  it('sets the output variables', () => {
    const params = { ...DefaultParams };
    params.releaseType = 'preminor';
    params.preid = 'beta';
    const result = runAction(params);

    expect(result.isError).toBeFalsy();

    expect(result.outputs).toHaveProperty('version', '1.1.0-beta.0');
    expect(result.outputs).toHaveProperty('release-notes', '### Added%0A%0A- Initial content including change log%0A');
  });
});

function runAction(params: ActionParams): ActionResult {
  const env: NodeJS.ProcessEnv = {
    GITHUB_WORKSPACE: __dirname,
  };

  env['INPUT_COMMAND'] = 'bump';

  if (params.changelog !== null) {
    env['INPUT_CHANGELOG'] = params.changelog;
  }

  if (params.releaseType !== null) {
    env['INPUT_VERSION'] = params.releaseType;
  }

  if (params.preid !== null) {
    env['INPUT_PREID'] = params.preid;
  }

  if (params.releaseDate !== null) {
    env['INPUT_RELEASE-DATE'] = params.releaseDate;
  }

  if (params.tagPrefix !== null) {
    env['INPUT_TAG-PREFIX'] = params.tagPrefix;
  }

  if (params.outputFile !== null) {
    env['INPUT_OUTPUT-FILE'] = params.outputFile;
  }

  env['INPUT_KEEP-UNRELEASED-SECTION'] = params.keepUnreleasedSection.toString();
  env['INPUT_FAIL-ON-EMPTY-RELEASE-NOTES'] = params.failOnEmptyReleaseNotes.toString();

  if (params.githubRepo !== null) {
    env['GITHUB_REPOSITORY'] = params.githubRepo;
  }

  return invokeActionScript(path.join(__dirname, '../index.js'), env);
}
