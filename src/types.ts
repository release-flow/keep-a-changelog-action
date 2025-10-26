import type { Parent } from 'unist';
import { Heading } from 'mdast';
import semver from 'semver';
import { ReleaseType } from 'semver';

/**
 * The properties of a release (extracted from the heading).
 *
 * @exports ReleaseProps
 * @interface ReleaseProps
 */
export interface ReleaseProps {
  /**
   * The release version number.
   *
   * @type {semver.SemVer}
   * @memberof ReleaseProps
   */
  version: semver.SemVer;
  /**
   * The release date.
   *
   * @type {Date}
   * @memberof ReleaseProps
   */
  date: Date;
  /**
   * The release suffix (everything in the header that comes after the date).
   *
   * @type {(string | undefined)}
   * @memberof ReleaseProps
   */
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
  // The heading's node in the syntax tree
  node: Heading;
  // The heading's parent node in the syntax tree
  parent: Parent;
  // The release associated with this heading
  release: ReleaseSpec;
}

export class BoneheadedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
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
  release: true,
};

export function isValidReleaseType(maybe: string): maybe is ReleaseType {
  return validReleaseTypes.hasOwnProperty(maybe);
}

// Augment the vfile.Data interface to include our processor data
declare module 'vfile' {
  interface DataMap {
    releaseHeadings: ReleaseHeading[];
  }
}