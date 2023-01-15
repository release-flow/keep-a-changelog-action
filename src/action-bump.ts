import process from 'process';
import path from 'path';
import { isValid, parseISO } from 'date-fns';

import { unified } from 'unified';
import { VFile } from 'vfile';
import { read, write } from 'to-vfile';
import { remark } from 'remark';
import { reporter } from 'vfile-reporter';
import stringify from 'remark-stringify';
import * as core from '@actions/core';
import { ReleaseType } from 'semver';

import { ChangelogError, ReleaseHeading } from './types.js';
import { BumpOptions, RepoSpec } from './options.js';

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

// This is a compiler-safe mechanism to ensure that all possible ReleaseType
// values are defined. If the ReleaseType type definition changes (not under our
// control, it's part of the node-semver library) then this definition will
// cause a compile-time error. See https://stackoverflow.com/a/66820587/260213
// for the inspiration.
const validReleaseTypes: Record<ReleaseType, unknown> = {
  major: true,
  premajor: true,
  minor: true,
  preminor: true,
  patch: true,
  prepatch: true,
  prerelease: true,
};

function isValidReleaseType(maybe: string): maybe is ReleaseType {
  return validReleaseTypes.hasOwnProperty(maybe);
}

function getRepoOptions(): RepoSpec | undefined {
  const githubRepository = process.env['GITHUB_REPOSITORY'] ?? '';
  const [owner, repo] = githubRepository.split('/');

  if (!owner || !repo) {
    core.setFailed(
      'Unable to determine the repository name - check that the GITHUB_REPOSITORY environment variable is correctly set'
    );
    return;
  }

  return { owner, repo };
}

/**
 * Gets a BumpOptions instance with values derived from the action inputs.
 *
 * @returns {(BumpOptions | undefined)}
 */
function getPrepareReleaseOptions(): BumpOptions | undefined {
  let changelogPath: string = core.getInput('changelog') ?? 'CHANGELOG.md';
  if (!path.isAbsolute(changelogPath)) {
    const root = process.env['GITHUB_WORKSPACE'] ?? process.cwd();
    changelogPath = path.join(root, changelogPath);
  }

  const releaseType: string = core.getInput('version') ?? 'patch';
  if (!isValidReleaseType(releaseType)) {
    core.setFailed(
      `Input 'version' has an invalid value '${releaseType}'. The value must be one of: major, premajor, minor, preminor, patch, prepatch, or prerelease`
    );
    return;
  }

  let releaseDate = new Date();
  const releaseDateText = core.getInput('release-date');
  if (releaseDateText) {
    releaseDate = parseISO(releaseDateText);

    if (!isValid(releaseDate)) {
      core.setFailed(
        `Input 'release-date' has an invalid value '${releaseDateText}'. The value must be a date in ISO 8601 format, e.g. '2022-03-03'`
      );
      return;
    }
  }

  const preid = core.getInput('preid');

  let tagPrefix = core.getInput('tag-prefix');
  if (tagPrefix === null || tagPrefix === undefined) {
    tagPrefix = 'v';
  }

  const outputFile = core.getInput('output-file');

  const repoOptions = getRepoOptions();

  if (!repoOptions) {
    return;
  }

  const keepUnreleasedSection = core.getBooleanInput('keep-unreleased-section');

  const options: BumpOptions = {
    changelogPath,
    releaseDate,
    version: releaseType,
    tagPrefix,
    preid: preid,
    repo: repoOptions,
    outputFile,
    keepUnreleasedSection,
  };

  return options;
}

async function processChangelog(file: VFile, options: BumpOptions): Promise<VFile> {
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
      unified().use(extractReleaseNotes, 'unreleased').use(stringify, { listItemIndent: 'one', bullet: '-' })
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

export default async function bump(): Promise<void> {
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

    core.setOutput('version', updated.data['nextReleaseVersion']);
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
