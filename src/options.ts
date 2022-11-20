import process from 'process';
import path from 'path';
import { ReleaseType } from 'semver';
import { isValid, parseISO } from 'date-fns';
import * as core from '@actions/core';
import semver from 'semver';

export interface RepoOptions {
  owner: string;
  repo: string;
}

export interface PrepareReleaseOptions {
  changelogPath: string;
  releaseType: ReleaseType;
  prereleaseIdentifier?: string;
  releaseDate: Date;
  tagPrefix: string;
  repo: RepoOptions;
  outputFile: string | undefined;
}

export interface GetReleaseNotesOptions {
  changelogPath: string;
  version: semver.SemVer | 'unreleased';
}

export type VersionOptionSpec = semver.SemVer | 'unreleased' | 'latest';

export interface GetReleaseInfoOptions {
  changelogPath: string;
  version: VersionOptionSpec;
}

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

function getRepoOptions(): RepoOptions | undefined {
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
 * Gets a PrepareReleaseOptions instance with values derived from the action inputs.
 *
 * @export
 * @returns {(PrepareReleaseOptions | undefined)}
 */
export function getPrepareReleaseOptions(): PrepareReleaseOptions | undefined {
  let changelogPath: string = core.getInput('changelog') ?? 'CHANGELOG.md';
  if (!path.isAbsolute(changelogPath)) {
    const root = process.env['GITHUB_WORKSPACE'] ?? process.cwd();
    changelogPath = path.join(root, changelogPath);
  }

  const releaseType: string = core.getInput('release-type') ?? 'patch';
  if (!isValidReleaseType(releaseType)) {
    core.setFailed(
      `Input 'release-type' has an invalid value '${releaseType}'. The value must be one of: major, premajor, minor, preminor, patch, prepatch, or prerelease`
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

  const prereleaseIdentifier = core.getInput('prerelease-identifier');

  let tagPrefix = core.getInput('tag-prefix');
  if (tagPrefix === null || tagPrefix === undefined) {
    tagPrefix = 'v';
  }

  const outputFile = core.getInput('output-file');

  const repoOptions = getRepoOptions();

  if (!repoOptions) {
    return;
  }

  const options: PrepareReleaseOptions = {
    changelogPath,
    releaseDate,
    releaseType,
    tagPrefix,
    prereleaseIdentifier,
    repo: repoOptions,
    outputFile,
  };

  return options;
}

export function getGetReleaseNotesOptions(): GetReleaseNotesOptions | undefined {
  let changelogPath: string = core.getInput('changelog') ?? 'CHANGELOG.md';
  if (!path.isAbsolute(changelogPath)) {
    const root = process.env['GITHUB_WORKSPACE'] ?? process.cwd();
    changelogPath = path.join(root, changelogPath);
  }

  const version = core.getInput('release-version') ?? 'unreleased';
  let target: semver.SemVer | 'unreleased';
  if (version !== 'unreleased') {
    const parsed = semver.parse(version);
    if (!parsed) {
      core.setFailed(
        `Input 'release-version' contains invalid value '${version}'. It must contain a valid version or 'unreleased'`
      );
      return;
    }
    target = parsed;
  } else {
    target = version;
  }

  return {
    changelogPath,
    version: target,
  };
}

/**
 * Gets a GetReleaseInfoOptions instance with values derived from the action inputs.
 *
 * @export
 * @returns {(GetReleaseInfoOptions | undefined)}
 */
export function getGetReleaseInfoOptions(): GetReleaseInfoOptions | undefined {
  let changelogPath: string = core.getInput('changelog') ?? 'CHANGELOG.md';
  if (!path.isAbsolute(changelogPath)) {
    const root = process.env['GITHUB_WORKSPACE'] ?? process.cwd();
    changelogPath = path.join(root, changelogPath);
  }

  const version = core.getInput('release-version') ?? 'latest';
  let target: VersionOptionSpec;

  switch (version) {
    case 'unreleased':
    case 'latest':
      target = version;
      break;

    default:
      const parsed = semver.parse(version);
      if (!parsed) {
        core.setFailed(
          `Input 'release-version' contains invalid value '${version}'. It must contain a valid version or one of the values ('latest', 'unreleased')`
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
