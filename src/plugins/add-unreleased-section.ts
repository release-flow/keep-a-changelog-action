import { Plugin } from 'unified';
import { VFile } from 'vfile';
import type { Root, LinkReference, Heading } from 'mdast';

import { ReleaseHeading } from '../types.js';
import { Parent } from 'unist';

const attacher: Plugin<any, Root, Root> = function () {
  const processorData = this.data;

  return (tree: Root, _file: VFile) => {
    const releaseHeadings = processorData('releaseHeadings') as ReleaseHeading[];

    if (releaseHeadings.length > 0 && releaseHeadings[0].release === 'unreleased') {
      // Unreleased already exists - no-op
      return tree;
    }

    const unreleasedSection: Heading = { type: 'heading', depth: 2, children: [] };
    const versionText = 'Unreleased';

    const unreleaseHeadingContents: [LinkReference] = [
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
    ];

    unreleasedSection.children = unreleaseHeadingContents;

    // Insert the new Unreleased section into the correct place in the document. This should be before the
    // first release heading if present, otherwise at the end of the document
    let parent: Parent;
    if (releaseHeadings.length === 0) {
      // No release headings in the file - add the new section at the end of the syntax tree
      tree.children.push(unreleasedSection);
      parent = tree;
    } else {
      // Insert unreleasedSection before releaseHeadings[0].node
      parent = releaseHeadings[0].parent ?? tree;
      const index = parent.children.indexOf(releaseHeadings[0].node);
      parent.children.splice(index, 0, unreleasedSection);
    }

    const unreleasedHeading: ReleaseHeading = { node: unreleasedSection, parent, release: 'unreleased' };
    releaseHeadings.splice(0, 0, unreleasedHeading);

    return tree;
  };
};

export default attacher;
