import { Plugin } from 'unified';
import { VFile } from 'vfile';
import type { Content, Root } from 'mdast';
import between from 'unist-util-find-all-between';
import { findAllAfter as after } from 'unist-util-find-all-after';
import { Data, Node } from 'unist';

import { BoneheadedError, ReleaseHeading } from '../types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const attacher: Plugin<any, Root, Root> = function extractUnreleasedContents() {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const processorData = this.data;

  return (tree: Root, _file: VFile) => {
    const releaseHeadings = processorData('releaseHeadings') as ReleaseHeading[];

    if (!releaseHeadings) {
      throw new BoneheadedError('File should have been preprocessed before calling this plugin');
    }

    const newRoot: Root = { type: 'root', children: [] };

    // If there are no releases then pass on an empty document
    if (releaseHeadings.length === 0) {
      return newRoot;
    }

    // If the first release section is not 'Unreleased' then pass on an empty document
    if (releaseHeadings[0].release !== 'unreleased') {
      return newRoot;
    }

    // The terminator node can be undefined, e.g. if the section is the last section in the file
    // and there are no definitions at the end
    const terminatorNode = releaseHeadings[0].node.data?.['nextSection'] as Node<Data> | undefined;
    const result = terminatorNode
      ? between(tree, releaseHeadings[0].node, terminatorNode)
      : after(tree, releaseHeadings[0].node);

    newRoot.children.push(...(result as Content[]));

    return newRoot;
  };
};

export default attacher;
