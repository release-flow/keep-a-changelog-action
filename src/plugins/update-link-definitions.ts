import { Plugin } from 'unified';
import { VFile } from 'vfile';
import type { Root, LinkReference, Text, Definition } from 'mdast';
import { remove } from 'unist-util-remove';
import { format } from 'date-fns';

import { BumpOptions } from '../options.js';
import { BoneheadedError, ReleaseHeading } from '../types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const attacher: Plugin<[BumpOptions], Root, Root> = function (options: BumpOptions) {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const processorData = this.data;
  return transformer;

  function transformer(tree: Root, _file: VFile) {
    const releaseHeadings = processorData('releaseHeadings') as ReleaseHeading[];

    if (!releaseHeadings) {
      throw new BoneheadedError('File should have been preprocessed before calling this plugin');
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    remove(tree, 'definition');

    for (let i = 0; i < releaseHeadings.length; i++) {
      const node = releaseHeadings[i].node;
      const props = releaseHeadings[i].release;
      if (props === 'unreleased') {
        throw new BoneheadedError(
          'Unreleased section should have been converted to release. Did you forget to run the increment-release plugin?'
        );
      }

      // Update the heading
      const versionText = props.version.format();
      const tagText = `${options.tagPrefix}${versionText}`;
      const dateText = ' - ' + format(props.date, 'yyyy-MM-dd');
      const suffix = props.suffix ? ` ${props.suffix}` : '';

      const newHeadingContents: [LinkReference, Text] = [
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
          value: `${dateText}${suffix}`,
        },
      ];

      node.children = newHeadingContents;

      // Regenerate the definition node. If we are processing the last release,
      // the link is in a different format from the others
      if (i + 1 < releaseHeadings.length) {
        const nextProps = releaseHeadings[i + 1].release;
        if (nextProps === 'unreleased') {
          throw new BoneheadedError(
            'Unreleased section should have been converted to release. Did you forget to run the increment-release plugin?'
          );
        }
        const nextVersionText = nextProps.version.format();
        const nextTagText = `${options.tagPrefix}${nextVersionText}`;
        const url = `https://github.com/${options.repo.owner}/${options.repo.repo}/compare/${nextTagText}...${tagText}`;
        const definition: Definition = {
          type: 'definition',
          url,
          identifier: tagText,
          label: versionText,
        };
        tree.children.push(definition);
      } else {
        const url = `https://github.com/${options.repo.owner}/${options.repo.repo}/releases/tag/${tagText}`;
        const definition: Definition = {
          type: 'definition',
          url,
          identifier: tagText,
          label: versionText,
        };
        tree.children.push(definition);
      }
    }
  }
};

export default attacher;
