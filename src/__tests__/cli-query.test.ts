import * as path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { globby } from 'globby';

import './jest-file-diff.js';

import { getCliErrors, invokeCommandLine, CliResult } from './test-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = path.join(__dirname, '../..');

interface CliParams {
  changelog: string | null;
  version: string | null;
}

const DefaultParams: CliParams = {
  changelog: 'good_changelog.md',
  version: 'latest',
};

interface ParsedResult {
  cli: CliResult;
  output: any;
}

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
    const result = runCommand(params);

    expect(result.cli.isError).toBeTruthy();
    expect(getCliErrors(result.cli)).toContain(
      "Input 'version' contains invalid value 'burble'. It must contain a valid version or one of the values ('latest', 'unreleased', 'latest-or-unreleased')"
    );
  });

  it('errors when the changelog does not have an unreleased version', () => {
    const params = { ...DefaultParams };
    params.changelog = 'changelog_no_unreleased.md';
    params.version = 'unreleased';
    const result = runCommand(params);

    expect(result.cli.isError).toBeTruthy();
    expect(getCliErrors(result.cli)).toContain("The specified release, 'unreleased', was not found in the changelog");
  });

  it('errors when the changelog does not have the specified version', () => {
    const params = { ...DefaultParams };
    params.version = '17.18.19';
    const result = runCommand(params);

    expect(result.cli.isError).toBeTruthy();
    expect(getCliErrors(result.cli)).toContain("The specified release, '17.18.19', was not found in the changelog");
  });

  it('errors when latest requested but the changelog does not have any versions', () => {
    const params = { ...DefaultParams };
    params.changelog = 'initial_changelog_2.md';
    params.version = 'latest';
    const result = runCommand(params);

    expect(result.cli.isError).toBeTruthy();
    expect(getCliErrors(result.cli)).toContain("The specified release, 'latest', was not found in the changelog");
  });

  it('sets the output variables for the latest version', () => {
    const params = { ...DefaultParams };
    const result = runCommand(params);

    expect(result.cli.isError).toBeFalsy();

    expect(result.output).toHaveProperty('version', '1.0.0');
    expect(result.output).toHaveProperty('release-date', '2022-02-04');
    expect(result.output).toHaveProperty('release-notes', '### Added\n\n- Final polish\n');
  });

  it('sets the output variables for the unreleased version', () => {
    const params = { ...DefaultParams };
    params.version = 'unreleased';
    const result = runCommand(params);

    expect(result.cli.isError).toBeFalsy();

    expect(result.output).toHaveProperty('version', '[unreleased]');
    expect(result.output).toHaveProperty('release-date', null);
    expect(result.output).toHaveProperty('release-notes', '### Added\n\n- Initial content including change log\n');
  });
});

it('sets the output variables for a specified version', () => {
  const params = { ...DefaultParams };
  params.version = '1.0.0-beta.1';
  const result = runCommand(params);

  expect(result.cli.isError).toBeFalsy();

  expect(result.output).toHaveProperty('version', '1.0.0-beta.1');
  expect(result.output).toHaveProperty('release-date', '2022-02-03');
  expect(result.output).toHaveProperty('release-notes', '### Added\n\n- Some features\n');
});

it('returns latest version when latest-or-unreleased requested and the changelog has a release section', () => {
  const params = { ...DefaultParams };
  params.changelog = 'good_changelog.md';
  params.version = 'latest-or-unreleased';
  const result = runCommand(params);

  expect(result.cli.isError).toBeFalsy();
  expect(result.output).toHaveProperty('version', '1.0.0');
  expect(result.output).toHaveProperty('release-date', '2022-02-04');
  expect(result.output).toHaveProperty('release-notes', '### Added\n\n- Final polish\n');
});

it('returns unreleased when latest-or-unreleased requested and the changelog only has unreleased section', () => {
  const params = { ...DefaultParams };
  params.changelog = 'initial_changelog_2.md';
  params.version = 'latest-or-unreleased';
  const result = runCommand(params);

  expect(result.cli.isError).toBeFalsy();
  expect(result.output).toHaveProperty('version', '[unreleased]');
  expect(result.output).toHaveProperty('release-date', null);
  expect(result.output).toHaveProperty('release-notes', '### Added\n\n- Initial content including change log\n');
});

it('errors when latest-or-unreleased requested but the changelog does not have any versions', () => {
  const params = { ...DefaultParams };
  params.changelog = 'changelog_empty.md';
  params.version = 'latest-or-unreleased';
  const result = runCommand(params);

  expect(result.cli.isError).toBeTruthy();
  expect(getCliErrors(result.cli)).toContain('No release headings in changelog');
});

function runCommand(params: CliParams): ParsedResult {
  const env: NodeJS.ProcessEnv = {};

  const argv: string[] = ['query'];

  if (params.changelog !== null) {
    argv.push('--changelog');
    argv.push(params.changelog);
  }

  if (params.version !== null) {
    argv.push('--version');
    argv.push(params.version);
  }

  const cliResult = invokeCommandLine(path.join(__dirname, '../cli.js'), __dirname, argv, env);

  const result: ParsedResult = {
    cli: cliResult,
    output: null,
  };

  if (!cliResult.isError) {
    result.output = JSON.parse(cliResult.stdout);
  }
  return result;
}
