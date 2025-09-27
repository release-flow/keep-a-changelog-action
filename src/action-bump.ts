import process from 'process';
import path from 'path';
import { isValid, parseISO } from 'date-fns';

import { VFileMessage } from 'vfile-message';
import { read } from 'to-vfile';
import { reporter } from 'vfile-reporter';
import * as core from '@actions/core';
import { isValidReleaseType } from './types.js';

import { BumpOptions, RepoSpec } from './options.js';
import { bump } from './commands.js';
import { GitHubReleaseLinkGenerator } from './release-link-generator.js';

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
function getBumpOptions(): BumpOptions | undefined {
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

  const linkGenerator = new GitHubReleaseLinkGenerator(repoOptions, tagPrefix);

  const keepUnreleasedSection = core.getBooleanInput('keep-unreleased-section');
  const failOnEmptyReleaseNotes = core.getBooleanInput('fail-on-empty-release-notes');

  const options: BumpOptions = {
    changelogPath,
    releaseDate,
    version: releaseType,
    tagPrefix,
    preid: preid,
    outputFile,
    keepUnreleasedSection,
    failOnEmptyReleaseNotes,
    linkGenerator: linkGenerator,
  };

  return options;
}

export default async function bumpAction(): Promise<void> {
  const options = getBumpOptions();

  if (!options) {
    // Input error - core.setFailed() should already have been called
    return;
  }

  const changelog = await read(options.changelogPath, { encoding: 'utf-8' });

  try {
    const updated = await bump(changelog, options);

    core.setOutput('version', updated.data['nextReleaseVersion']);
    core.setOutput('release-notes', updated.data['releaseNotes']);

    if (updated.messages.length > 0) {
      core.warning('Changelog: warnings were encountered');
      core.startGroup('Changelog warning report');
      core.info(reporter(updated));
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
