import { ReleaseLinkGenerator as ReleaseLinkGenerator, RepoSpec } from './options.js';
import { BoneheadedError, isReleaseProps, ReleaseSpec } from './types.js';

export class GitHubReleaseLinkGenerator implements ReleaseLinkGenerator {
  repoSpec: RepoSpec;
  tagPrefix: string;

  constructor(repoSpec: RepoSpec, tagPrefix: string) {
    this.repoSpec = repoSpec;
    this.tagPrefix = tagPrefix;
  }

  createLinkUrl(current: ReleaseSpec, previous?: ReleaseSpec): string {
    const versionText = isReleaseProps(current) ? current.version.format() : 'Unreleased';
    const gitRef = isReleaseProps(current) ? `${this.tagPrefix}${versionText}` : 'HEAD';

    if (previous) {
      if (previous === 'unreleased') {
        throw new BoneheadedError('Previous release must not be an [Unreleased] release');
      }

      const prevVersionText = previous.version.format();
      const prevTagText = `${this.tagPrefix}${prevVersionText}`;
      const url = `https://github.com/${this.repoSpec.owner}/${this.repoSpec.repo}/compare/${prevTagText}...${gitRef}`;
      return url;
    } else {
      const url = `https://github.com/${this.repoSpec.owner}/${this.repoSpec.repo}/releases/tag/${gitRef}`;

      return url;
    }
  }
}
