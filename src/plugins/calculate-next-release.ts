import { Plugin } from 'unified';
import { Node } from 'unist';
import { VFile } from 'vfile';
import semver from 'semver';
const { SemVer } = semver;

import { BoneheadedError, isReleaseProps, ReleaseHeading, ReleaseProps } from '../types.js';
import { BumpOptions } from '../options.js';

const attacher: Plugin = function (options: BumpOptions) {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const processorData = this.data;
  return transformer;

  function transformer(_tree: Node, file: VFile) {
    const releaseHeadings = processorData('releaseHeadings') as ReleaseHeading[];

    if (!releaseHeadings) {
      throw new BoneheadedError('File should have been preprocessed before calling this plugin');
    }

    const latestRelease = releaseHeadings.find((h) => {
      return isReleaseProps(h.release);
    });

    const latestVersion = latestRelease ? (<ReleaseProps>latestRelease.release).version : new SemVer('0.0.0');

    file.data['nextReleaseVersion'] = semver.inc(
      latestVersion.format(),
      options.version,
      undefined,
      options.preid
    );
  }
};

export default attacher;
