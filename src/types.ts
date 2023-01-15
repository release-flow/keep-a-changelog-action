import type { Parent } from 'unist';
import { Heading } from 'mdast';
import semver from 'semver';

/**
 * The properties of a release (extracted from the heading).
 *
 * @export
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
