import { Plugin } from 'unified';
import { VFile } from 'vfile';
import type { Root } from 'mdast';
import semver from 'semver';

import { BoneheadedError } from '../types.js';
import { BumpOptions } from '../options.js';
import { isPrereleaseHeading } from './merge-prereleases.js';

const attacher: Plugin<[BumpOptions], Root, Root> = function checkUnreleasedSectionExists(options: BumpOptions) {
  return (_tree: Root, file: VFile) => {
    const releaseHeadings = file.data.releaseHeadings;

    if (!releaseHeadings) {
      throw new BoneheadedError('File should have been preprocessed before calling this plugin');
    }

    // If there are no releases then pass on an empty document
    if (releaseHeadings.length === 0) {
      file.message('No release sections found. The changelog must contain an unreleased section').fatal = true;
      return;
    }

    // If the first release section is not 'Unreleased' then pass on an empty document
    if (releaseHeadings[0].release !== 'unreleased') {
      let message = "The changelog must contain an 'unreleased' section as the first release section";

      const nextReleaseVersion = file.data.nextReleaseVersion;
      if (
        !options.mergePrereleases &&
        isPrereleaseHeading(releaseHeadings[0]) &&
        nextReleaseVersion &&
        semver.prerelease(nextReleaseVersion) === null
      ) {
        message +=
          '. To release the prereleases without an [Unreleased] section, enable merge-prereleases to merge them into the new release';
      }

      file.message(message).fatal = true;
      return;
    }
  };
};

export default attacher;
