import { Heading } from 'mdast';
import semver from 'semver';

export interface ReleaseProps {
  version: semver.SemVer;
  date: Date;
  suffix: string | undefined;
}

export type ReleaseSpec = ReleaseProps | 'unreleased';

export function isReleaseSpec(maybe: unknown): maybe is ReleaseSpec {
  return maybe === 'unreleased' || isReleaseProps(maybe);
}

export function isReleaseProps(maybe: unknown): maybe is ReleaseProps {
  return (
    maybe !== null &&
    maybe !== undefined &&
    typeof maybe === 'object' &&
    'version' in maybe &&
    (maybe as ReleaseProps).version instanceof semver.SemVer &&
    'date' in maybe &&
    (maybe as ReleaseProps).date instanceof Date
  );
}

export interface ReleaseHeading {
  node: Heading;
  release: ReleaseSpec;
}

export class ChangelogError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class BoneheadedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
