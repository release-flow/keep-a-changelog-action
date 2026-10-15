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

    if (options.version instanceof SemVer) {
      if (options.version.compare(latestVersion) <= 0) {
        file.fail(
          `Specified version ${options.version.format()} must be greater than latest version ${latestVersion.format()}`
        );
      }

      file.data['nextReleaseVersion'] = options.version.format();
    } else {
      const next = semver.inc(latestVersion.format(), options.version, undefined, options.preid);

      if (!next) {
        if (options.version === 'release' && latestVersion.prerelease.length === 0) {
          file.fail(
            `Version type 'release' can only be used when the latest release is a prerelease, but the latest version is ${latestVersion.format()}. Use major, minor or patch, or specify an explicit version.`
          );
        }

        file.fail(
          `Unable to calculate the next version from ${latestVersion.format()} using version type '${options.version}'.`
        );
      }

      file.data['nextReleaseVersion'] = next;
    }
  }
};

export default attacher;
