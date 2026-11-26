import { Plugin } from 'unified';
import { VFile } from 'vfile';
import type { Root } from 'mdast';
import semver from 'semver';
const { SemVer } = semver;

import { BoneheadedError, isReleaseProps, ReleaseHeading } from '../types.js';
import { QueryVersionOptionSpec, isQuerySpecialVersionOption } from '../options.js';
import { getReleaseNotes } from './release-notes.js';

function findReleaseHeading(target: QueryVersionOptionSpec, headings: ReleaseHeading[]): ReleaseHeading | null {
  let unreleasedHeading: ReleaseHeading | null = null;
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];

    if (heading.release === 'unreleased') {
      unreleasedHeading = heading;
      if (target === 'unreleased') {
        return heading;
      }
      continue;
    } else if (target === 'latest' || target === 'latest-or-unreleased') {
      return heading;
    } else if (target instanceof SemVer && semver.eq(heading.release.version, target)) {
      return heading;
    }
  }

  return target === 'latest-or-unreleased' ? unreleasedHeading : null;
}

const attacher: Plugin<[QueryVersionOptionSpec], Root, Root> = function extractUnreleasedContents(
  target: QueryVersionOptionSpec
) {
  return (tree: Root, file: VFile) => {
    const releaseHeadings = file.data.releaseHeadings;

    if (!releaseHeadings) {
      throw new BoneheadedError('File should have been preprocessed before calling this plugin');
    }

    if (releaseHeadings.length === 0) {
      file.fail('The changelog does not contain any release sections.');
    }

    const heading = findReleaseHeading(target, releaseHeadings);
    if (!heading) {
      const releaseText = isQuerySpecialVersionOption(target) ? target : target.format();
      file.fail(`The specified release, '${releaseText}', was not found in the changelog.`);
    }

    if (isReleaseProps(heading.release)) {
      file.data['matchedReleaseVersion'] = heading.release.version.format();
      file.data['matchedReleaseDate'] = heading.release.date;
      file.data['matchedReleaseSuffix'] = heading.release.suffix;
    } else {
      file.data['matchedReleaseVersion'] = '[unreleased]';
      file.data['matchedReleaseDate'] = undefined;
      file.data['matchedReleaseSuffix'] = undefined;
    }

    return getReleaseNotes(heading, tree);
  };
};

export default attacher;
