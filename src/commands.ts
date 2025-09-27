import { unified } from 'unified';
import { VFile } from 'vfile';
import { write } from 'to-vfile';
import { remark } from 'remark';
import stringify from 'remark-stringify';

import { ReleaseHeading } from './types.js';
import { BumpOptions, QueryOptions } from './options.js';

import bridge from './plugins/bridge.js';
import releaseParser from './plugins/release-parser.js';
import preprocess from './plugins/preprocessor.js';
import assert from './plugins/assert.js';
import checkUnreleasedSectionExists from './plugins/check-unreleased-section-exists.js';
import extractReleaseNotes from './plugins/extract-release-notes.js';
import incrementRelease from './plugins/increment-release.js';
import calculateNextRelease from './plugins/calculate-next-release.js';
import updateLinkDefinitions from './plugins/update-link-definitions.js';
import addEmptyUnreleasedSection from './plugins/add-unreleased-section.js';
import path from 'path';
import extractReleaseInfo from './plugins/extract-release-info.js';

async function processBumpChangelog(file: VFile, options: BumpOptions): Promise<VFile> {
  const releaseHeadings: ReleaseHeading[] = [];

  let processor = remark()
    .data('releaseHeadings', releaseHeadings)
    .use(releaseParser)
    .use(preprocess)
    .use(checkUnreleasedSectionExists)
    .use(assert)
    .use(
      bridge,
      'releaseNotes',
      unified().use(extractReleaseNotes, 'unreleased', options).use(stringify, { listItemIndent: 'one', bullet: '-' })
    )
    .use(calculateNextRelease, options)
    .use(incrementRelease, options);

  if (options.keepUnreleasedSection) {
    processor = processor.use(addEmptyUnreleasedSection);
  }

  const updated = await processor
    .use(updateLinkDefinitions, options)
    .use(stringify, { listItemIndent: 'one', bullet: '-' })
    .process(file);

  return updated;
}

export async function bump(changelog: VFile, options: BumpOptions): Promise<VFile> {
  const updated = await processBumpChangelog(changelog, options);

  if (options.outputFile) {
    const output = path.parse(options.outputFile);
    if (output.dir !== '.' && output.dir !== '') {
      updated.dirname = path.join(updated.dirname ?? updated.cwd, output.dir);
    }

    if (output.base !== updated.basename) {
      updated.basename = output.base;
    }
  }

  await write(updated, 'utf-8');

  return updated;
}

export async function query(file: VFile, options: QueryOptions): Promise<VFile> {
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
