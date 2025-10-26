import { Plugin } from 'unified';
import { VFile } from 'vfile';
import type { Root } from 'mdast';

import { BoneheadedError } from '../types.js';

const attacher: Plugin<any, Root, Root> = function checkUnreleasedSectionExists() {
  
  return (_tree: Root, file: VFile) => {
    const releaseHeadings = file.data.releaseHeadings;

    if (!releaseHeadings) {
      throw new BoneheadedError('File should have been preprocessed before calling this plugin');
    }

    // If there are no releases then pass on an empty document
    if (releaseHeadings.length === 0) {
      file.message('No release sections found. The changelog must contain an unreleased section').fatal = true;
      return;
    }

    // If the first release section is not 'Unreleased' then pass on an empty document
    if (releaseHeadings[0].release !== 'unreleased') {
      file.message("The changelog must contain an 'unreleased' section as the first release section").fatal = true;
      return;
    }
  };
};

export default attacher;
