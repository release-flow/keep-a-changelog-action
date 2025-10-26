import { Plugin } from 'unified';
import { VFile } from 'vfile';
import type { Root, LinkReference, Text } from 'mdast';
import { format } from 'date-fns';

import { BumpOptions } from '../options.js';
import semver from 'semver';
import { BoneheadedError } from '../types.js';

const { SemVer } = semver;

const attacher: Plugin<[BumpOptions], Root, Root> = function (options: BumpOptions) {

  return (tree: Root, file: VFile) => {
    const releaseHeadings = file.data.releaseHeadings;
    const nextReleaseVersion = file.data['nextReleaseVersion'] as string;

    if (!releaseHeadings) {
      throw new BoneheadedError('File should have been preprocessed before calling this plugin');
    }
    
    if (releaseHeadings.length === 0 || releaseHeadings[0].release !== 'unreleased') {
      file.fail("The 'Unreleased' section must be present");
    }

    const unreleasedSection = releaseHeadings[0].node;
    const versionText = nextReleaseVersion;
    const dateText = ' - ' + format(options.releaseDate, 'yyyy-MM-dd');

    const newReleaseSection: [LinkReference, Text] = [
      {
        type: 'linkReference',
        identifier: versionText,
        label: versionText,
        referenceType: 'shortcut',
        children: [
          {
            type: 'text',
            value: versionText,
          },
        ],
      },
      {
        type: 'text',
        value: dateText,
      },
    ];

    unreleasedSection.children = newReleaseSection;
    releaseHeadings[0].release = { version: new SemVer(nextReleaseVersion), date: options.releaseDate, suffix: '' };

    return tree;
  };
};

export default attacher;
