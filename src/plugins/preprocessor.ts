import { Plugin } from 'unified';
import { VFile } from 'vfile';
import type { Root, Heading, Definition } from 'mdast';
import semver from 'semver';

import { visit } from 'unist-util-visit';
import { is } from 'unist-util-is';

import { isReleaseSpec, ReleaseHeading } from '../types.js';

const attacher: Plugin<[], Root, Root> = function () {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const processorData = this.data;

  return (tree: Root, file: VFile) => {
    let previousReleaseHeading: Heading | null = null;
    let previousDefinition: Definition | null = null;
    const releaseHeadings: ReleaseHeading[] = [];

    // First pass - add the 'nextSection' data property to each release heading node to indicate the
    // node that starts the next section
    visit(tree, [{ type: 'heading', depth: 2 }, 'definition'], (node, _index, parent) => {
      if (is<Heading>(node, 'heading')) {
        const currentRelease = node.data?.release;

        if (!isReleaseSpec(currentRelease)) {
          // The h2 doesn't contain a valid release spec (release or undefined). A fatal error is
          // (should have been) already reported, so we can just skip for now.
          return;
        }

        if (previousDefinition) {
          const msg = file.message(
            'All release link definitions must be located at the end of the changelog',
            previousDefinition.position
          );
          msg.fatal = true;
          return;
        }

        if (previousReleaseHeading) {
          previousReleaseHeading.data!['nextSection'] = node;
        }

        previousReleaseHeading = node;
        releaseHeadings.push({ node, parent: parent || tree, release: currentRelease });
      }

      if (is<Definition>(node, 'definition') && previousReleaseHeading) {
        previousReleaseHeading.data!['nextSection'] = node;
        previousDefinition = node;
      }
    });

    // Iterate through the release headings to validate the rules:
    //  1. Check that the 'unreleased' heading, if present, is the first one in the file
    //  2. Ensure the release versions are in descending order (we don't validate the dates,
    //     just the version numbers).
    for (let i = 0; i < releaseHeadings.length; i++) {
      const currentHeading = releaseHeadings[i];

      if (i === 0) {
        continue;
      }

      const previousHeading = releaseHeadings[i - 1];
      if (previousHeading.release === 'unreleased') {
        continue;
      }

      if (currentHeading.release === 'unreleased') {
        // The unreleased section must be first in the file. Clearly it isn't!
        const msg = file.message(
          "The 'Unreleased' section must be unique, and must be the first release section in the file",
          currentHeading.node.position
        );
        msg.fatal = true;
        break;
      }

      if (semver.gte(currentHeading.release.version, previousHeading.release.version)) {
        const msg = file.message('Release sections must be in descending order', currentHeading.node.position);
        msg.fatal = true;
      }
    }

    // Save the release headings into the processor data so we can use it later instead of re-processing
    // all the headings
    const t = processorData('releaseHeadings') as ReleaseHeading[];

    // There shouldn't be anything in the array at this point, but clear it just in case
    t.length = 0;
    t.push(...releaseHeadings);
  };
};

export default attacher;
