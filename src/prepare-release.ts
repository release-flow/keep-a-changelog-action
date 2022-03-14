import { unified } from 'unified';
import { VFile } from 'vfile';
import { read, write } from 'to-vfile';
import { remark } from 'remark';
import { reporter } from 'vfile-reporter';
import stringify from 'remark-stringify';
import * as core from '@actions/core';

import { ChangelogError, ReleaseHeading } from './types.js';
import { getPrepareReleaseOptions, PrepareReleaseOptions } from './options.js';

import bridge from './plugins/bridge.js';
import releaseParser from './plugins/release-parser.js';
import preprocess from './plugins/preprocessor.js';
import assert from './plugins/assert.js';
import checkUnreleasedSectionExists from './plugins/check-unreleased-section-exists.js';
import extractReleaseNotes from './plugins/extract-release-notes.js';
import incrementRelease from './plugins/increment-release.js';
import calculateNextRelease from './plugins/calculate-next-release.js';
import updateLinkDefinitions from './plugins/update-link-definitions.js';

async function processChangelog(file: VFile, options: PrepareReleaseOptions): Promise<VFile> {
  const releaseHeadings: ReleaseHeading[] = [];

  const updated = await remark()
    .data('releaseHeadings', releaseHeadings)
    .use(releaseParser)
    .use(preprocess)
    .use(checkUnreleasedSectionExists)
    .use(assert)
    .use(
      bridge,
      'releaseNotes',
      unified().use(extractReleaseNotes, 'unreleased').use(stringify, { listItemIndent: 'one', bullet: '-' })
    )
    .use(calculateNextRelease, options)
    .use(incrementRelease, options)
    .use(updateLinkDefinitions, options)
    .use(stringify, { listItemIndent: 'one', bullet: '-' })
    .process(file);

  return updated;
}

async function run(): Promise<void> {
  const options = getPrepareReleaseOptions();

  if (!options) {
    // Input error - core.setFailed() should already have been called
    return;
  }

  const changelog = await read(options.changelogPath, { encoding: 'utf-8' });

  try {
    const updated = await processChangelog(changelog, options);

    if (options.outputFile) {
      updated.basename = options.outputFile;
    }

    await write(updated, { encoding: 'utf-8', mode: null });

    core.setOutput('release-version', updated.data['releaseVersion']);
    core.setOutput('release-notes', updated.data['releaseNotes']);

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
