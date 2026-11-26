import { Plugin } from 'unified';
import { VFile } from 'vfile';
import type { Root, RootContent, Heading, List } from 'mdast';
import { toString } from 'mdast-util-to-string';
import { is } from 'unist-util-is';
import semver from 'semver';

import { BumpOptions } from '../options.js';
import { BoneheadedError, isReleaseProps, ReleaseHeading } from '../types.js';

interface Subsection {
  // The level 3 heading that starts the subsection, or null for content that precedes any level 3 heading
  heading: Heading | null;
  content: RootContent[];
}

/**
 * Returns true if the release heading is for a prerelease version, e.g. 1.0.0-beta.1.
 */
export function isPrereleaseHeading(heading: ReleaseHeading | undefined): boolean {
  return heading !== undefined && isReleaseProps(heading.release) && heading.release.version.prerelease.length > 0;
}

function appendToSubsection(subsection: Subsection, node: RootContent): void {
  if (is(node, 'list')) {
    const existing = subsection.content.find((n): n is List => is(n, 'list') && n.ordered === node.ordered);
    if (existing) {
      existing.children.push(...node.children);
      existing.spread = Boolean(existing.spread || node.spread);
      return;
    }
  }

  subsection.content.push(node);
}

/**
 * Merges the contents of several release sections (newest first) into the contents of a single section. Level 3
 * subsections with the same heading text (e.g. '### Added') are combined into one subsection, in the order in which
 * they first appear, and lists within a subsection are joined into a single list. Content that precedes the first
 * level 3 heading of a section is gathered at the start of the merged section.
 *
 * @param sections The contents of each section, excluding the release headings, newest first.
 * @returns The merged section contents.
 */
export function mergeSections(sections: RootContent[][]): RootContent[] {
  const preamble: Subsection = { heading: null, content: [] };
  const subsections = new Map<string, Subsection>();

  for (const section of sections) {
    let current = preamble;
    for (const node of section) {
      if (is(node, 'heading') && node.depth === 3) {
        const key = toString(node).trim().toLowerCase();
        let subsection = subsections.get(key);
        if (!subsection) {
          subsection = { heading: node, content: [] };
          subsections.set(key, subsection);
        }
        current = subsection;
        continue;
      }

      appendToSubsection(current, node);
    }
  }

  const result: RootContent[] = [...preamble.content];
  for (const subsection of subsections.values()) {
    result.push(subsection.heading!, ...subsection.content);
  }

  return result;
}

/**
 * A unified attacher that, when the mergePrereleases option is set, merges all the prerelease sections since the
 * latest full release (together with the 'Unreleased' section, if present) into a single section that is then
 * treated as the 'Unreleased' section by the rest of the bump pipeline. Must run after calculateNextRelease.
 */
const attacher: Plugin<[BumpOptions], Root, Root> = function mergePrereleases(options: BumpOptions) {
  return (tree: Root, file: VFile) => {
    if (!options.mergePrereleases) {
      return;
    }

    const releaseHeadings = file.data.releaseHeadings;
    const nextReleaseVersion = file.data.nextReleaseVersion;

    if (!releaseHeadings || !nextReleaseVersion) {
      throw new BoneheadedError('File should have been preprocessed and the next release calculated');
    }

    if (semver.prerelease(nextReleaseVersion) !== null) {
      file.fail(
        `Prereleases can only be merged into a full release, but the next version is ${nextReleaseVersion}. Use release, major, minor or patch, or specify an explicit non-prerelease version.`
      );
    }

    const start = releaseHeadings[0]?.release === 'unreleased' ? 1 : 0;
    let end = start;
    while (end < releaseHeadings.length && isPrereleaseHeading(releaseHeadings[end])) {
      end++;
    }

    if (end === start) {
      // No prereleases to merge
      return;
    }

    // The section that receives the merged content: the 'Unreleased' section if present, otherwise the latest
    // prerelease, which becomes the section to be released
    const group = releaseHeadings.slice(0, end);
    const target = group[0];
    const last = group[group.length - 1];
    const parent = target.parent;

    if (group.some((h) => h.parent !== parent)) {
      throw new BoneheadedError('Release headings should share the same parent');
    }

    const children = parent.children as RootContent[];
    const startIndex = children.indexOf(target.node);
    const terminator = last.node.data?.nextSection as RootContent | undefined;
    const terminatorIndex = terminator ? children.indexOf(terminator) : -1;
    const endIndex = terminatorIndex >= 0 ? terminatorIndex : children.length;

    // Split the nodes between the target heading and the end of the last merged section into per-release sections
    const groupNodes = new Set<RootContent>(group.map((h) => h.node));
    const sections: RootContent[][] = [[]];
    for (const node of children.slice(startIndex + 1, endIndex)) {
      if (groupNodes.has(node)) {
        sections.push([]);
      } else {
        sections[sections.length - 1].push(node);
      }
    }

    children.splice(startIndex + 1, endIndex - startIndex - 1, ...mergeSections(sections));

    file.data.mergedPrereleaseVersions = group
      .map((h) => h.release)
      .filter(isReleaseProps)
      .map((r) => r.version.format());

    target.node.data = { ...target.node.data, nextSection: terminator };
    target.release = 'unreleased';
    releaseHeadings.splice(1, end - 1);
  };
};

export default attacher;
