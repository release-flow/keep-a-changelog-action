import { Plugin } from 'unified';
import { VFile } from 'vfile';
import type { Content, Root } from 'mdast';
import between from 'unist-util-find-all-between';
import { findAllAfter as after } from 'unist-util-find-all-after';
import { Data, Node } from 'unist';
import semver from 'semver';
const { SemVer } = semver;

import { BoneheadedError, ReleaseHeading } from '../types.js';
import { BumpOptions } from '../options.js';

function getReleaseNotes(heading: ReleaseHeading, tree: Root): Root {
  const root: Root = { type: 'root', children: [] };

  // The terminator node can be undefined, e.g. if the section is the last section in the file
  // and there are no definitions at the end
  const terminatorNode = heading.node.data?.['nextSection'] as Node<Data> | undefined;
  const result = terminatorNode ? between(tree, heading.node, terminatorNode) : after(tree, heading.node);

  root.children.push(...(result as Content[]));

  return root;
}

function findReleaseHeading(target: semver.SemVer | 'unreleased', headings: ReleaseHeading[]): ReleaseHeading | null {
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];

    if (heading.release === 'unreleased') {
      if (target === 'unreleased') {
        return heading;
      }
      continue;
    } else if (target instanceof SemVer && semver.eq(heading.release.version, target)) {
      return heading;
    }
  }

  return null;
}

const attacher: Plugin<[semver.SemVer | 'unreleased', BumpOptions], Root, Root> = function extractReleaseNotes(
  target: semver.SemVer | 'unreleased',
  options: BumpOptions
) {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const processorData = this.data;

  return (tree: Root, file: VFile) => {
    const releaseHeadings = processorData('releaseHeadings') as ReleaseHeading[];

    if (!releaseHeadings) {
      throw new BoneheadedError('File should have been preprocessed before calling this plugin');
    }

    if (releaseHeadings.length === 0) {
      file.fail('No releases in changelog');
    }

    const heading = findReleaseHeading(target, releaseHeadings);
    if (!heading) {
      const releaseText = target === 'unreleased' ? 'unreleased' : target.format();
      file.fail(`The specified release, '${releaseText}', was not found in the changelog`);
    }

    const releaseNotes = getReleaseNotes(heading, tree);

    if (options.failOnEmptyReleaseNotes) {
      const hasEmptyReleaseNotes = releaseNotes.children.length === 0;

      if (hasEmptyReleaseNotes) {
        file.fail(
          'The changelog does not contain any release notes in the [Unreleased] section, and the action is configured to fail if this is empty.',
          heading.node.position
        );
      }
    }

    return releaseNotes;
  };
};

export default attacher;
