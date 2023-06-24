import type { Content, Root } from 'mdast';
import between from 'unist-util-find-all-between';
import { findAllAfter as after } from 'unist-util-find-all-after';
import { Data, Node } from 'unist';

import { ReleaseHeading } from './types.js';

export function getReleaseNotes(heading: ReleaseHeading, tree: Root): Root {
  const root: Root = { type: 'root', children: [] };

  // The terminator node can be undefined, e.g. if the section is the last section in the file
  // and there are no definitions at the end
  const terminatorNode = heading.node.data?.['nextSection'] as Node<Data> | undefined;
  const result = terminatorNode ? between(tree, heading.node, terminatorNode) : after(tree, heading.node);

  root.children.push(...(result as Content[]));

  return root;
}
