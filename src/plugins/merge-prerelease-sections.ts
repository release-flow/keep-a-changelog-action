import { Plugin } from 'unified';
import { VFile } from 'vfile';
import type { Root, LinkReference, Text, Heading } from 'mdast';
import { visit } from 'unist-util-visit';
import { is } from 'unist-util-is';
import { format } from 'date-fns';
import semver from 'semver';

import { isReleaseProps, ReleaseHeading } from '../types.js';
import { BumpOptions } from '../options.js';
import { getReleaseNotes } from '../utils.js';

const { SemVer } = semver;

function getStuff() {

}

const attacher: Plugin<[BumpOptions], Root, Root> = function mergePrereleaseNotes(options: BumpOptions) {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const processorData = this.data;

  return (tree: Root, file: VFile) => {
    const releaseHeadings = processorData('releaseHeadings') as ReleaseHeading[];
    const nextReleaseVersion = file.data['nextReleaseVersion'] as string;

    if (releaseHeadings.length === 0) {
      file.fail(
        'No releases found in the changelog - at least one prerelease heading must be present when collapse-prerelease-sections is set'
      );
    }

    let i;
    for (i = 0; i < releaseHeadings.length; i++) {
      const release = releaseHeadings[i].release;
      // Break on the first non-prerelease heading
      if (!isReleaseProps(release) || semver.prerelease(release.version) !== null) {
        break;
      }
    }

    if (i === 0) {
      file.fail(
        'The changelog must start with at least one prerelease version when collapse-prerelease-sections is set.'
      );
    }

    // Prevent index error in case all the release headings are prerelease
    const releasesToMergeCount = i >= releaseHeadings.length ? releaseHeadings.length : i;

    for (let i = 0; i < releasesToMergeCount; i++) {
      const releaseNotes = getReleaseNotes(releaseHeadings[i], tree);

      let currentHeading = '';

      visit(releaseNotes, (node, index, parent) => {
        // Level 3 headings contain sub-sections such as 'Added', 'Changed', etc.
        if (is<Heading>(node, { type: 'heading', depth: 3 })) {
          const textNode = node.children[0];
        }
      });
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
