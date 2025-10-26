import { Plugin } from 'unified';
import { VFile } from 'vfile';
import type { Root, LinkReference, Text } from 'mdast';
import { format } from 'date-fns';

import { ReleaseHeading } from '../types.js';
import { BumpOptions } from '../options.js';
import semver from 'semver';

const { SemVer } = semver;

const attacher: Plugin<[BumpOptions], Root, Root> = function (options: BumpOptions) {
  const processorData = this.data;

  return (tree: Root, file: VFile) => {
    const releaseHeadings = processorData('releaseHeadings') as ReleaseHeading[];
    const nextReleaseVersion = file.data['nextReleaseVersion'] as string;

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
