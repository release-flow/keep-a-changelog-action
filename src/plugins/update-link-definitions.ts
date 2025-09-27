import { Plugin } from 'unified';
import { VFile } from 'vfile';
import type { Root, LinkReference, Text, Definition, PhrasingContent } from 'mdast';
import { remove } from 'unist-util-remove';
import { format } from 'date-fns';

import { BumpOptions } from '../options.js';
import { BoneheadedError, isReleaseProps, ReleaseHeading } from '../types.js';

const attacher: Plugin<[BumpOptions], Root, Root> = function (options: BumpOptions) {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const processorData = this.data;
  return transformer;

  function transformer(tree: Root, _file: VFile) {
    const releaseHeadings = processorData('releaseHeadings') as ReleaseHeading[];

    if (!releaseHeadings) {
      throw new BoneheadedError('File should have been preprocessed before calling this plugin');
    }

    remove(tree, 'definition');

    for (let i = 0; i < releaseHeadings.length; i++) {
      const node = releaseHeadings[i].node;
      const props = releaseHeadings[i].release;

      // Update the heading
      const versionText = isReleaseProps(props) ? props.version.format() : 'Unreleased';
      const gitRef = isReleaseProps(props) ? `${options.tagPrefix}${versionText}` : 'HEAD';

      const headingLink: LinkReference = {
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
      };

      const newHeadingContents: PhrasingContent[] = [headingLink];

      if (isReleaseProps(props)) {
        const dateText = ' - ' + format(props.date, 'yyyy-MM-dd');
        const suffix = props.suffix ? ` ${props.suffix}` : '';

        const text: Text = {
          type: 'text',
          value: `${dateText}${suffix}`,
        };

        newHeadingContents.push(text);
      }

      node.children = newHeadingContents;

      // Regenerate the link definition node. If we are processing the last release in the changelog,
      // the link is in a different format from the others
      let definition: Definition | undefined;
      if (i === releaseHeadings.length - 1) {
        const url = options.linkGenerator?.createLinkUrl(props);
        if (url) {
          definition = {
            type: 'definition',
            url,
            identifier: gitRef,
            label: versionText,
          };
        }
      } else {
        const nextRelease = releaseHeadings[i + 1].release;
        if (nextRelease === 'unreleased') {
          throw new BoneheadedError('Unreleased section should be the first level 2 heading in the changelog');
        }
        const url = options.linkGenerator?.createLinkUrl(props, nextRelease);
        if (url) {
          definition = {
            type: 'definition',
            url,
            identifier: gitRef,
            label: versionText,
          };
        }
      }
      if (definition) {
        tree.children.push(definition);
      }
    }
  }
};

export default attacher;
