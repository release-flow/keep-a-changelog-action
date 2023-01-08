import { ReleaseType } from 'semver';

import semver from 'semver';

export interface RepoSpec {
  owner: string;
  repo: string;
}

export interface BumpOptions {
  changelogPath: string;
  releaseType: ReleaseType;
  prereleaseIdentifier?: string;
  releaseDate: Date;
  tagPrefix: string;
  repo: RepoSpec;
  outputFile: string | undefined;
}

export type SpecialVersionOption = 'unreleased' | 'latest' | 'latest-or-unreleased';
export type VersionOptionSpec = semver.SemVer | SpecialVersionOption;

export interface QueryOptions {
  changelogPath: string;
  version: VersionOptionSpec;
}

export function isSpecialVersionOption(maybe: VersionOptionSpec): maybe is SpecialVersionOption {
  return maybe === 'latest' || maybe === 'unreleased' || maybe === 'latest-or-unreleased';
}
