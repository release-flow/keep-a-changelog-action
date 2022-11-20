import { VFile } from 'vfile';
import { read } from 'to-vfile';
import { remark } from 'remark';
import { reporter } from 'vfile-reporter';
import stringify from 'remark-stringify';
import * as core from '@actions/core';

import { ChangelogError, ReleaseHeading } from './types.js';
import { getGetReleaseInfoOptions, GetReleaseInfoOptions } from './options.js';

import releaseParser from './plugins/release-parser.js';
import preprocess from './plugins/preprocessor.js';
import assert from './plugins/assert.js';
import extractReleaseInfo from './plugins/extract-release-info.js';
import { format } from 'date-fns';

async function processChangelog(file: VFile, options: GetReleaseInfoOptions): Promise<VFile> {
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

async function run(): Promise<void> {
  const options = getGetReleaseInfoOptions();

  if (!options) {
    // Input error - core.setFailed() should already have been called
    return;
  }

  const changelog = await read(options.changelogPath, { encoding: 'utf-8' });

  try {
    const updated = await processChangelog(changelog, options);

    const result = updated.toString();
    core.setOutput('release-notes', result);
    core.setOutput('release-version', updated.data['matchedReleaseVersion']);
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
      if (changelog.messages.length === 0) {
        core.setFailed(error.message);
      } else {
        core.setFailed('Changelog contains errors');
        core.startGroup('Changelog error report');
        console.log(reporter(changelog));
        core.endGroup();
      }
    } else {
      console.error(error);
    }
  }
}

void run();
