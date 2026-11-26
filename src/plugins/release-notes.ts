import type { Root, RootContent } from 'mdast';
import between from 'unist-util-find-all-between';
import { findAllAfter as after } from 'unist-util-find-all-after';
import { Node } from 'unist';

import { ReleaseHeading } from '../types.js';

/**
 * Returns the release notes for a release section: the nodes between its heading and the start of
 * the next section, as recorded by the preprocessor.
 */
export function getReleaseNotes(heading: ReleaseHeading, tree: Root): Root {
  const root: Root = { type: 'root', children: [] };

  // The terminator node can be undefined, e.g. if the section is the last section in the file
  // and there are no definitions at the end
  const terminatorNode = heading.node.data?.['nextSection'] as Node | undefined;
  const result = terminatorNode ? between(tree, heading.node, terminatorNode) : after(tree, heading.node);

  root.children.push(...(result as RootContent[]));

  return root;
}
