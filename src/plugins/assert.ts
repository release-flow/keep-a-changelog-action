import { Plugin } from 'unified';
import { Node } from 'unist';
import { VFile } from 'vfile';
import { ChangelogError } from '../types.js';

const attacher: Plugin = function () {
  return (_tree: Node, file: VFile) => {
    if (file.messages.find((m) => m.fatal === true)) {
      throw new ChangelogError('Fatal errors were encountered');
    }
  };
};

export default attacher;
