import { Plugin } from 'unified';
import { Node } from 'unist';
import { VFile } from 'vfile';
import semver from 'semver';
const { SemVer } = semver;

import { BoneheadedError, isReleaseProps, ReleaseProps } from '../types.js';
import { BumpOptions } from '../options.js';
import { Root } from 'mdast';

const attacher: Plugin<any, Root, Root> = function (options: BumpOptions) {
  return transformer;

  function transformer(_tree: Node, file: VFile) {
    const releaseHeadings = file.data.releaseHeadings;

    if (!releaseHeadings) {
      throw new BoneheadedError('File should have been preprocessed before calling this plugin');
    }

    const latestRelease = releaseHeadings.find((h) => {
      return isReleaseProps(h.release);
    });

    const latestVersion = latestRelease ? (<ReleaseProps>latestRelease.release).version : new SemVer('0.0.0');

    file.data['nextReleaseVersion'] = semver.inc(latestVersion.format(), options.version, undefined, options.preid);
  }
};

export default attacher;
