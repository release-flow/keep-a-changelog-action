import path from 'path';
import { isValid, parseISO } from 'date-fns';
import { reporter } from 'vfile-reporter';
import { VFileMessage } from 'vfile-message';
import { read } from 'to-vfile';

import semver from 'semver';
import { isValidReleaseType } from './types.js';
import { BumpOptions, RepoSpec } from './options.js';
import { CliBumpArguments } from './cli-types.js';
import { bump as bumpCommand } from './commands.js';
import { GitHubReleaseLinkGenerator } from './release-link-generator.js';

/**
 * Gets a BumpOptions instance with values derived from the action inputs.
 *
 * @returns {(BumpOptions | undefined)}
 */
function getBumpOptions(argv: CliBumpArguments): BumpOptions | string {
  const root = process.cwd();

  let changelogPath: string = argv.changelog ?? 'CHANGELOG.md';
  if (!path.isAbsolute(changelogPath)) {
    changelogPath = path.join(root, changelogPath);
  }

  let releaseType: string | semver.SemVer = argv.version ?? 'patch';
  if (!isValidReleaseType(releaseType)) {
    if (semver.valid(releaseType)) {
      // It's a valid semver, so use that
      releaseType = new semver.SemVer(releaseType);
    } else {
      return `Input 'version' has an invalid value '${releaseType}'. The value must be one of: major, premajor, minor, preminor, patch, prepatch, prerelease, or release. Alternatively, it can be a valid semantic version number.`;
    }
  }

  let releaseDate = new Date();
  const releaseDateText = argv.releaseDate;
  if (releaseDateText) {
    releaseDate = parseISO(releaseDateText);

    if (!isValid(releaseDate)) {
      return `Input 'release-date' has an invalid value '${releaseDateText}'. The value must be a date in ISO 8601 format, e.g. '2022-03-03'`;
    }
  }

  let githubRepo = argv.githubRepo;
  if (argv.githubRepo === null || (argv.githubRepo !== undefined && argv.githubRepo.trim() === '')) {
    githubRepo = undefined;
  }

  let tagPrefix = argv.tagPrefix;
  if (tagPrefix === null || tagPrefix === undefined) {
    tagPrefix = 'v';
  }

  let linkGenerator: GitHubReleaseLinkGenerator | undefined;
  if (githubRepo) {
    const repoOptions = getRepoOptions(githubRepo);
    if (typeof repoOptions === 'string') {
      return `Input 'github-repo' has an invalid value '${githubRepo}'. The value must be in the format 'owner/repo'`;
    }
    linkGenerator = new GitHubReleaseLinkGenerator(repoOptions, tagPrefix);
  } else {
    linkGenerator = undefined;
  }

  const preid = argv.preid;

  const outputFile = argv.outputFile;

  const keepUnreleasedSection = argv.keepUnreleasedSection;
  const failOnEmptyReleaseNotes = argv.failOnEmptyReleaseNotes;

  const options: BumpOptions = {
    changelogPath,
    releaseDate,
    version: releaseType,
    tagPrefix,
    preid: preid,
    outputFile,
    keepUnreleasedSection,
    failOnEmptyReleaseNotes,
    linkGenerator,
  };

  return options;
}

export default async function bump(argv: CliBumpArguments): Promise<number> {
  const options = getBumpOptions(argv);
  if (typeof options === 'string') {
    console.error(`ERROR: ${options}`);
    return -3;
  }

  const changelog = await read(options.changelogPath, { encoding: 'utf-8' });

  try {
    const updated = await bumpCommand(changelog, options);
    if (updated.messages.length > 0) {
      console.info(reporter(updated));
    }

    return 0;
  } catch (error) {
    if (error instanceof VFileMessage) {
      console.error(`ERROR: ${error.message}`);
      return -1;
    }

    console.error(error);
    return -2;
  }
}

function getRepoOptions(githubRepo: string): RepoSpec | string {
  const [owner, repo] = githubRepo.split('/');

  if (!owner || !repo) {
    return 'Invalid repository name';
  }

  return { owner, repo };
}
