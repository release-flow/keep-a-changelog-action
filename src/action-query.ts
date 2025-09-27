import process from 'process';
import path from 'path';

import { default as semver } from 'semver';
import { VFileMessage } from 'vfile-message';
import { read } from 'to-vfile';
import { reporter } from 'vfile-reporter';
import * as core from '@actions/core';
import { format } from 'date-fns';

import { QueryOptions, QueryVersionOptionSpec } from './options.js';

import { query } from './commands.js';

/**
 * Gets a QueryOptions instance with values derived from the action inputs.
 *
 * @returns {(QueryOptions | undefined)}
 */
function getQueryOptions(): QueryOptions | undefined {
  let changelogPath: string = core.getInput('changelog') ?? 'CHANGELOG.md';
  if (!path.isAbsolute(changelogPath)) {
    const root = process.env['GITHUB_WORKSPACE'] ?? process.cwd();
    changelogPath = path.join(root, changelogPath);
  }

  const version = core.getInput('version') ?? 'latest';
  let target: QueryVersionOptionSpec;

  switch (version) {
    case 'unreleased':
    case 'latest':
    case 'latest-or-unreleased':
      target = version;
      break;

    default:
      const parsed = semver.parse(version);
      if (!parsed) {
        core.setFailed(
          `Input 'version' contains invalid value '${version}'. It must contain a valid version or one of the values ('latest', 'unreleased', 'latest-or-unreleased')`
        );
        return;
      }
      target = parsed;
      break;
  }

  return {
    changelogPath,
    version: target,
  };
}

export default async function queryAction(): Promise<void> {
  const options = getQueryOptions();

  if (!options) {
    // Input error - core.setFailed() should already have been called
    return;
  }

  const changelog = await read(options.changelogPath, { encoding: 'utf-8' });

  try {
    const updated = await query(changelog, options);

    const result = updated.toString();
    core.setOutput('release-notes', result);
    core.setOutput('version', updated.data['matchedReleaseVersion']);
    const date = updated.data['matchedReleaseDate'];
    if (date instanceof Date) {
      core.setOutput('release-date', format(date, 'yyyy-MM-dd'));
    } else {
      core.setOutput('release-date', '');
    }
    core.setOutput('release-suffix', updated.data['matchedReleaseSuffix'] ?? '');

    if (updated.messages.length > 0) {
      core.warning('Changelog: warnings were encountered');
      core.startGroup('Changelog warning report');
      console.log(reporter(updated));
      core.endGroup();
    }
  } catch (error) {
    if (error instanceof VFileMessage) {
      core.setFailed(error.message);
      if (changelog.messages.length > 0) {
        core.startGroup('Changelog error report');
        core.error(reporter(changelog));
        core.endGroup();
      }
    } else if (error instanceof Error) {
      core.setFailed(error.message);
      core.startGroup('Error details');
      core.error(error);
      core.endGroup();
    } else {
      core.setFailed('An unexpected error occurred');
      console.error(error);
    }
  }
}
