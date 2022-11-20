import * as path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { globby } from 'globby';

import './jest-file-diff.js';

import { invokeActionScript, getAllErrors, ActionResult, getAllWarnings } from './test-utils.js';

// eslint-disable-next-line no-underscore-dangle
const __filename = fileURLToPath(import.meta.url);
// eslint-disable-next-line no-underscore-dangle
const __dirname = path.dirname(__filename);

const root = path.join(__dirname, '../..');

interface ActionParams {
  changelog: string | null;
  version: string | null;
}

const DefaultParams: ActionParams = {
  changelog: 'good_changelog.md',
  version: 'unreleased',
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

  it('errors when release-version is invalid', () => {
    const params = { ...DefaultParams };
    params.version = 'burble';
    const result = runAction(params);

    expect(result.isError).toBeTruthy();
    expect(getAllErrors(result)).toContain(
      "Input 'release-version' contains invalid value 'burble'. It must contain a valid version or 'unreleased'"
    );
  });

  it('errors when the changelog does not have an unreleased version', () => {
    const params = { ...DefaultParams };
    params.changelog = 'changelog_no_unreleased.md';
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

  it('sets the output variables', () => {
    const params = { ...DefaultParams };
    const result = runAction(params);

    expect(result.isError).toBeFalsy();

    expect(result.outputs).toHaveProperty('release-notes', '### Added%0A%0A- Initial content including change log%0A');
  });

  it('emits a deprecation warning', () => {
    const params = { ...DefaultParams };
    const result = runAction(params);

    expect(result.isError).toBeFalsy();

    const o = getAllWarnings(result);
    expect(o).toContain(
      'This action is deprecated, and will be removed in a future version. Use the get-release-info action instead.'
    );
  });
});

function runAction(params: ActionParams): ActionResult {
  const env: NodeJS.ProcessEnv = {
    GITHUB_WORKSPACE: __dirname,
  };

  if (params.changelog !== null) {
    env['INPUT_CHANGELOG'] = params.changelog;
  }

  if (params.version !== null) {
    env['INPUT_RELEASE-VERSION'] = params.version;
  }

  return invokeActionScript(path.join(__dirname, '../get-release-notes.js'), env);
}
