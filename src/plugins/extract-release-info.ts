import { Plugin } from 'unified';
import { VFile } from 'vfile';
import type { Content, Root } from 'mdast';
import between from 'unist-util-find-all-between';
import { findAllAfter as after } from 'unist-util-find-all-after';
import { Data, Node } from 'unist';
import semver from 'semver';
const { SemVer } = semver;

import { BoneheadedError, ChangelogError, isReleaseProps, ReleaseHeading } from '../types.js';
import { VersionOptionSpec } from '../options.js';

function getReleaseNotes(heading: ReleaseHeading, tree: Root): Root {
  const root: Root = { type: 'root', children: [] };

  // The terminator node can be undefined, e.g. if the section is the last section in the file
  // and there are no definitions at the end
  const terminatorNode = heading.node.data?.['nextSection'] as Node<Data> | undefined;
  const result = terminatorNode ? between(tree, heading.node, terminatorNode) : after(tree, heading.node);

  root.children.push(...(result as Content[]));

  return root;
}

function findReleaseHeading(target: VersionOptionSpec, headings: ReleaseHeading[]): ReleaseHeading | null {
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];

    if (heading.release === 'unreleased') {
      if (target === 'unreleased') {
        return heading;
      }
      continue;
    } else if (target === 'latest') {
      return heading;
    } else if (target instanceof SemVer && semver.eq(heading.release.version, target)) {
      return heading;
    }
  }

  return null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const attacher: Plugin<[VersionOptionSpec], Root, Root> = function extractUnreleasedContents(
  target: VersionOptionSpec
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
      const releaseText = target === 'unreleased' || target === 'latest' ? target : target.format();
      throw new ChangelogError(`The specified release, '${releaseText}', was not found in the changelog`);
    }

    if (isReleaseProps(heading.release)) {
      file.data['matchedReleaseVersion'] = heading.release.version.format();
      file.data['matchedReleaseDate'] = heading.release.date;
      file.data['matchedReleaseSuffix'] = heading.release.suffix;
    } else {
      file.data['matchedReleaseVersion'] = '[unreleased]';
      file.data['matchedReleaseDate'] = undefined;
      file.data['matchedReleaseSuffix'] = undefined;
    }

    return getReleaseNotes(heading, tree);
  };
};

export default attacher;
