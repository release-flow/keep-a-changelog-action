import { ReleaseType } from 'semver';

import semver from 'semver';

export interface RepoSpec {
  owner: string;
  repo: string;
}

export interface BumpOptions {
  changelogPath: string;
  version: ReleaseType;
  preid?: string;
  releaseDate: Date;
  tagPrefix: string;
  repo: RepoSpec;
  outputFile: string | undefined;
}

export type QuerySpecialVersionOption = 'unreleased' | 'latest' | 'latest-or-unreleased';
export type QueryVersionOptionSpec = semver.SemVer | QuerySpecialVersionOption;

export interface QueryOptions {
  changelogPath: string;
  version: QueryVersionOptionSpec;
}

export function isQuerySpecialVersionOption(maybe: QueryVersionOptionSpec): maybe is QuerySpecialVersionOption {
  return maybe === 'latest' || maybe === 'unreleased' || maybe === 'latest-or-unreleased';
}
