import { unified } from 'unified';
import { VFile } from 'vfile';
import { read, write } from 'to-vfile';
import { remark } from 'remark';
import { reporter } from 'vfile-reporter';
import stringify from 'remark-stringify';
import * as core from '@actions/core';

import { ChangelogError, ReleaseHeading } from './types.js';
import getOptions, { ChangelogOptions } from './options.js';

import bridge from './plugins/bridge.js';
import releaseParser from './plugins/release-parser.js';
import preprocess from './plugins/preprocessor.js';
import assert from './plugins/assert.js';
import checkUnreleasedSectionExists from './plugins/check-unreleased-section-exists.js';
import extractReleaseContent from './plugins/extract-release-content.js';
import incrementRelease from './plugins/increment-release.js';
import calculateNextRelease from './plugins/calculate-next-release.js';
import updateLinkDefinitions from './plugins/update-link-definitions.js';

async function processChangelog(file: VFile, options: ChangelogOptions): Promise<VFile> {
  const releaseHeadings: ReleaseHeading[] = [];

  const updated = await remark()
    .data('releaseHeadings', releaseHeadings)
    .use(releaseParser)
    .use(preprocess)
    .use(checkUnreleasedSectionExists)
    .use(assert)
    .use(bridge, 'unreleasedContent', unified().use(extractReleaseContent).use(stringify))
    .use(calculateNextRelease, options)
    .use(incrementRelease, options)
    .use(updateLinkDefinitions, options)
    .use(stringify, { listItemIndent: 'one' })
    .process(file);

  console.log(file.data.unreleasedContent);
  return updated;
}

async function run(): Promise<void> {
  const options = getOptions();

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

    core.setOutput('new-release-version', updated.data['nextReleaseVersion']);

    if (updated.messages.length > 0) {
      core.warning('Changelog: warnings were encountered');
      core.startGroup('Changelog warning report');
      console.log(reporter(updated));
      core.endGroup();
    }
  } catch (error) {
    if (error instanceof ChangelogError) {
      core.setFailed('Changelog contains errors');
      core.startGroup('Changelog error report');
      console.log(reporter(changelog));
      core.endGroup();
    } else {
      console.error(error);
    }
  }
}

void run();
