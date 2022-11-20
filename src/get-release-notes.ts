import { VFile } from 'vfile';
import { read } from 'to-vfile';
import { remark } from 'remark';
import { reporter } from 'vfile-reporter';
import stringify from 'remark-stringify';
import * as core from '@actions/core';

import { ChangelogError, ReleaseHeading } from './types.js';
import { getGetReleaseNotesOptions, GetReleaseNotesOptions } from './options.js';

import releaseParser from './plugins/release-parser.js';
import preprocess from './plugins/preprocessor.js';
import assert from './plugins/assert.js';
import extractReleaseNotes from './plugins/extract-release-notes.js';

async function processChangelog(file: VFile, options: GetReleaseNotesOptions): Promise<VFile> {
  const releaseHeadings: ReleaseHeading[] = [];

  const updated = await remark()
    .data('releaseHeadings', releaseHeadings)
    .use(releaseParser)
    .use(preprocess)
    .use(assert)
    .use(extractReleaseNotes, options.version)
    .use(stringify, { listItemIndent: 'one', bullet: '-' })
    .process(file);

  return updated;
}

async function run(): Promise<void> {
  core.warning('This action is deprecated, and will be removed in a future version.');

  const options = getGetReleaseNotesOptions();

  if (!options) {
    // Input error - core.setFailed() should already have been called
    return;
  }

  const changelog = await read(options.changelogPath, { encoding: 'utf-8' });

  try {
    const updated = await processChangelog(changelog, options);

    const result = updated.toString();
    core.setOutput('release-notes', result);

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
