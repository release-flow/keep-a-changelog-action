import { Plugin } from 'unified';
import { VFile } from 'vfile';
import type { Root } from 'mdast';
import semver from 'semver';
const { SemVer } = semver;

import { BoneheadedError, ReleaseHeading } from '../types.js';
import { BumpOptions } from '../options.js';
import { getReleaseNotes } from '../utils.js';

function findReleaseHeading(target: semver.SemVer | 'unreleased', headings: ReleaseHeading[]): ReleaseHeading | null {
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];

    if (heading.release === 'unreleased') {
      if (target === 'unreleased') {
        return heading;
      }
      continue;
    } else if (target instanceof SemVer && semver.eq(heading.release.version, target)) {
      return heading;
    }
  }

  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const attacher: Plugin<[BumpOptions], Root, Root> = function extractReleaseNotes(options: BumpOptions) {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const processorData = this.data;

  return (tree: Root, file: VFile) => {
    const releaseHeadings = processorData('releaseHeadings') as ReleaseHeading[];

    if (!releaseHeadings) {
      throw new BoneheadedError('File should have been preprocessed before calling this plugin');
    }

    if (releaseHeadings.length === 0) {
      file.fail('No releases in changelog');
    }
    const nextReleaseVersion = file.data['nextReleaseVersion'] as string;

    if (!nextReleaseVersion) {
      throw new BoneheadedError(
        'No value found for nextReleaseVersion in file data. Did you forget to call the increment-release plugin before this one?'
      );
    }

    const target = nextReleaseVersion === 'unreleased' ? 'unreleased' : semver.parse(nextReleaseVersion);

    if (!target) {
      throw new BoneheadedError('Invalid nextReleaseVersion in file data');
    }

    const heading = findReleaseHeading(target, releaseHeadings);
    if (!heading) {
      const releaseText = target === 'unreleased' ? 'unreleased' : target.format();
      file.fail(`The specified release, '${releaseText}', was not found in the changelog`);
    }

    const releaseNotes = getReleaseNotes(heading, tree);

    if (options.failOnEmptyReleaseNotes) {
      const hasEmptyReleaseNotes = releaseNotes.children.length === 0;

      if (hasEmptyReleaseNotes) {
        file.fail(
          'The changelog does not contain any release notes in the [Unreleased] section, and the action is configured to fail if this is empty.',
          heading.node.position
        );
      }
    }

    return releaseNotes;
  };
};

export default attacher;
