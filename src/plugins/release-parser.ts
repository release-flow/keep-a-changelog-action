import { VFile } from 'vfile';
import type { Root, Heading, LinkReference, Text } from 'mdast';
import semver from 'semver';

import { visit } from 'unist-util-visit';
import { is } from 'unist-util-is';
import { BoneheadedError, ReleaseSpec } from '../types.js';

function parseReleaseHeadingTextOnly(node: Heading, file: VFile): void {
  const textNode = node.children[0];
  if (!is<Text>(textNode, 'text')) {
    // Should have been checked by caller
    throw new BoneheadedError('Should have been a text node, was ' + node.type);
  }

  const m = textNode.value.match(/^\[?([A-Za-z0-9.+-]+)\]?(\s+-\s*(\d{4}-\d{2}-\d{2}))?\s*(.*)$/);
  if (!m) {
    const msg = file.message('Level 2 heading in incorrect format', textNode.position);
    msg.fatal = true;
    msg.expected = ['1.2.3 - yyyy-mm-dd', '[1.2.3] - yyyy-mm-dd'];
    msg.actual = textNode.value;
    return;
  }

  let release: ReleaseSpec;

  // First submatch group contains the version, or Unreleased
  if (m[1].toLowerCase() === 'unreleased') {
    release = 'unreleased';
  } else {
    const version = semver.parse(m[1]);

    if (!version) {
      const msg = file.message(
        `Unable to parse semantic version from level 2 heading: '${m[1]}' is not a valid version`,
        textNode.position
      );
      msg.fatal = true;
      msg.actual = m[1];
      return;
    }

    release = { version, date: new Date(m[3]), suffix: m[4] };
  }

  node.data = { ...node.data,  release };
}

function parseReleaseHeadingWithLink(node: Heading, file: VFile): void {
  const linkNode = node.children[0];
  if (!is<LinkReference>(linkNode, 'linkReference')) {
    // Should have been checked by caller
    throw new BoneheadedError('Node should have been a linkReference, was ' + node.type);
  }

  if (linkNode.label?.toLowerCase() === 'unreleased') {
    // If it's unreleased, we don't care about the date
    node.data = { ...node.data,  release: 'unreleased' };
    return;
  }

  const version = semver.parse(linkNode.label);

  if (!version) {
    const msg = file.message(
      `Unable to parse semantic version from level 2 heading: '${linkNode.label || ''}' is not a valid version`,
      linkNode.position
    );
    msg.fatal = true;
    msg.actual = linkNode.label ?? null;
    return;
  }

  if (node.children.length === 1) {
    // We are expecting a release date as a sibling text node
    file.message('Release date missing', node.position).fatal = true;
    return;
  }

  const textNode = node.children[1];

  if (!is<Text>(textNode, 'text')) {
    file.message('Expected release date text to follow version link', textNode.position).fatal = true;
    return;
  }

  const m = textNode.value.match(/^\s*-\s*(\d{4}-\d{2}-\d{2})\s*(.*)$/);
  if (!m) {
    const msg = file.message("Release date in incorrect format. Expected ' - yyyy-mm-dd'", textNode.position);
    msg.fatal = true;
    msg.actual = textNode.value;
    return;
  }

  const release: ReleaseSpec = { version, date: new Date(m[1]), suffix: m[2] };

  node.data = { ...node.data,  release };
}

function parseReleaseHeading(node: Heading, file: VFile): void {
  // Release titles are level 2 headings in the following format:
  // [<release-version>] - <release-date>
  // The first part with the square brackets could be parsed to two syntax subtrees:
  //  - A single text node (if the version doesn't have a corresponding link)
  //  - A linkReference node followed by a text node (if the corresponding link exists)
  // A third possibility exists, only for the [Unreleased] version, which omits the release-date.
  // In this case there is either a text node or a linkReference

  if (node.children.length === 0) {
    file.message('Heading is empty', node.position).fatal = true;
    return;
  }

  if (is<LinkReference>(node.children[0], 'linkReference')) {
    parseReleaseHeadingWithLink(node, file);
  } else if (is<Text>(node.children[0], 'text')) {
    parseReleaseHeadingTextOnly(node, file);
  } else {
    const msg = file.message('Level 2 heading must define a release version', node.position);
    msg.fatal = true;
  }
}

/**
 * A unified attacher that returns a transformer that processes a changelog file. The
 * processing step analyses each level 2 heading and parses the release information
 * from it. Parsed release information is attached to the node's data. At the end of this
 * stage, if a h2 node has missing release data, this indicates that it could not be
 * successfully parsed, and a corresponding fatal message will be generated.
 *
 * See https://unifiedjs.com/learn/guide/create-a-plugin/ for further details about attachers
 * and transformers.
 *
 * @returns A Processor that preprocesses the input
 */
export default function releaseParser() {
  return (tree: Root, file: VFile) => {
    visit(tree, { type: 'heading', depth: 2 }, (node) => {
      parseReleaseHeading(node, file);
    });
  };
}
