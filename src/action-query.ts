import process from 'process';
import path from 'path';

import { default as semver } from 'semver';
import { VFile } from 'vfile';
import { read } from 'to-vfile';
import { remark } from 'remark';
import { reporter } from 'vfile-reporter';
import stringify from 'remark-stringify';
import * as core from '@actions/core';

import { ChangelogError, ReleaseHeading } from './types.js';
import { QueryOptions, VersionOptionSpec } from './options.js';

import releaseParser from './plugins/release-parser.js';
import preprocess from './plugins/preprocessor.js';
import assert from './plugins/assert.js';
import extractReleaseInfo from './plugins/extract-release-info.js';
import { format } from 'date-fns';

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
  let target: VersionOptionSpec;

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

async function processChangelog(file: VFile, options: QueryOptions): Promise<VFile> {
  const releaseHeadings: ReleaseHeading[] = [];

  const updated = await remark()
    .data('releaseHeadings', releaseHeadings)
    .use(releaseParser)
    .use(preprocess)
    .use(assert)
    .use(extractReleaseInfo, options.version)
    .use(stringify, { listItemIndent: 'one', bullet: '-' })
    .process(file);

  return updated;
}

export default async function query(): Promise<void> {
  const options = getQueryOptions();

  if (!options) {
    // Input error - core.setFailed() should already have been called
    return;
  }

  const changelog = await read(options.changelogPath, { encoding: 'utf-8' });

  try {
    const updated = await processChangelog(changelog, options);

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
    if (error instanceof ChangelogError) {
      core.setFailed(error.message);
      if (changelog.messages.length !== 0) {
        core.startGroup('Changelog error report');
        core.error(reporter(changelog));
        core.endGroup();
      }
    } else if (error instanceof Error) {
      core.setFailed(error.message);
      core.startGroup('Error details');
      console.error(error);
      core.endGroup();
    } else {
      console.log(error);
    }
  }
}
