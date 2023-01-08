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
  version: string | null;
  /**
   * Whether to use the new-style mechanism for GH workflow outputs, see
   * https://github.blog/changelog/2022-10-11-github-actions-deprecating-save-state-and-set-output-commands/
   *
   * @type {boolean}
   * @memberof ActionParams
   */
  newMechanism: boolean;
}

const DefaultParams: ActionParams = {
  changelog: 'good_changelog.md',
  version: 'latest',
  newMechanism: true,
};

describe('gh start action', () => {
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
    params.version = 'burble';
    const result = runAction(params);

    expect(result.isError).toBeTruthy();
    expect(getAllErrors(result)).toContain(
      "Input 'version' contains invalid value 'burble'. It must contain a valid version or one of the values ('latest', 'unreleased', 'latest-or-unreleased')"
    );
  });

  it('errors when the changelog does not have an unreleased version', () => {
    const params = { ...DefaultParams };
    params.changelog = 'changelog_no_unreleased.md';
    params.version = 'unreleased';
    const result = runAction(params);

    expect(result.isError).toBeTruthy();
    expect(getAllErrors(result)).toContain("The specified release, 'unreleased', was not found in the changelog");
  });

  it('errors when the changelog does not have the specified version', () => {
    const params = { ...DefaultParams };
    params.version = '17.18.19';
    const result = runAction(params);

    expect(result.isError).toBeTruthy();
    expect(getAllErrors(result)).toContain("The specified release, '17.18.19', was not found in the changelog");
  });

  it('errors when latest requested but the changelog does not have any versions', () => {
    const params = { ...DefaultParams };
    params.changelog = 'initial_changelog_2.md';
    params.version = 'latest';
    const result = runAction(params);

    expect(result.isError).toBeTruthy();
    expect(getAllErrors(result)).toContain("The specified release, 'latest', was not found in the changelog");
  });

  it('sets the output variables for the latest version, new mechanism', () => {
    const params = { ...DefaultParams };
    const result = runAction(params);

    expect(result.isError).toBeFalsy();

    expect(result.outputs).toHaveProperty('version', '1.0.0');
    expect(result.outputs).toHaveProperty('release-date', '2022-02-04');
    expect(result.outputs).toHaveProperty('release-notes', '### Added%0A%0A- Final polish%0A');
  });

  it('sets the output variables for the unreleased version', () => {
    const params = { ...DefaultParams };
    params.version = 'unreleased';
    const result = runAction(params);

    expect(result.isError).toBeFalsy();

    expect(result.outputs).toHaveProperty('version', '[unreleased]');
    expect(result.outputs).toHaveProperty('release-date', '');
    expect(result.outputs).toHaveProperty('release-notes', '### Added%0A%0A- Initial content including change log%0A');
  });
});

it('sets the output variables for a specified version', () => {
  const params = { ...DefaultParams };
  params.version = '1.0.0-beta.1';
  const result = runAction(params);

  expect(result.isError).toBeFalsy();

  expect(result.outputs).toHaveProperty('version', '1.0.0-beta.1');
  expect(result.outputs).toHaveProperty('release-date', '2022-02-03');
  expect(result.outputs).toHaveProperty('release-notes', '### Added%0A%0A- Some features%0A');
});

it('sets the output variables for a specified version, old output mechanism', () => {
  const params = { ...DefaultParams };
  params.version = '1.0.0-beta.1';
  params.newMechanism = false;
  const result = runAction(params);

  expect(result.isError).toBeFalsy();

  expect(result.outputs).toHaveProperty('version', '1.0.0-beta.1');
  expect(result.outputs).toHaveProperty('release-date', '2022-02-03');
  expect(result.outputs).toHaveProperty('release-notes', '### Added%0A%0A- Some features%0A');
});

it('returns latest version when latest-or-unreleased requested and the changelog has a release section', () => {
  const params = { ...DefaultParams };
  params.changelog = 'good_changelog.md';
  params.version = 'latest-or-unreleased';
  const result = runAction(params);

  expect(result.isError).toBeFalsy();
  expect(result.outputs).toHaveProperty('version', '1.0.0');
  expect(result.outputs).toHaveProperty('release-date', '2022-02-04');
  expect(result.outputs).toHaveProperty('release-notes', '### Added%0A%0A- Final polish%0A');
});

it('returns unreleased when latest-or-unreleased requested and the changelog only has unreleased section', () => {
  const params = { ...DefaultParams };
  params.changelog = 'initial_changelog_2.md';
  params.version = 'latest-or-unreleased';
  const result = runAction(params);

  expect(result.isError).toBeFalsy();
  expect(result.outputs).toHaveProperty('version', '[unreleased]');
  expect(result.outputs).toHaveProperty('release-date', '');
  expect(result.outputs).toHaveProperty('release-notes', '### Added%0A%0A- Initial content including change log%0A');
});

it('errors when latest-or-unreleased requested but the changelog does not have any versions', () => {
  const params = { ...DefaultParams };
  params.changelog = 'changelog_empty.md';
  params.version = 'latest-or-unreleased';
  const result = runAction(params);

  expect(result.isError).toBeTruthy();
  expect(getAllErrors(result)).toContain('No release headings in changelog');
});

function runAction(params: ActionParams): ActionResult {
  const env: NodeJS.ProcessEnv = {
    GITHUB_WORKSPACE: __dirname,
  };

  env['INPUT_COMMAND'] = 'query';

  if (params.changelog !== null) {
    env['INPUT_CHANGELOG'] = params.changelog;
  }

  if (params.version !== null) {
    env['INPUT_VERSION'] = params.version;
  }

  return invokeActionScript(path.join(__dirname, '../index.js'), env, params.newMechanism);
}
