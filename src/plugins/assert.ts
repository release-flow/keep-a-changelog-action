import { Plugin } from 'unified';
import { Node } from 'unist';
import { VFile } from 'vfile';

const attacher: Plugin = function () {
  return (_tree: Node, file: VFile) => {
    if (file.messages.some((m) => m.fatal === true)) {
      file.fail('Invalid changelog: fatal errors were detected');
    }
  };
};

export default attacher;
